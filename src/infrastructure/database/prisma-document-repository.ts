import {
  type CategoryInput,
  type CategoryRecord,
  CategoryCycleError,
  CategoryDepthExceededError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  type DocumentFilter,
  type DocumentInput,
  type DocumentRecord,
  type DocumentReferenceField,
  DocumentReferenceError,
  type DocumentRepository,
} from "@/application/ports/document-repository";
import { fitsUnder, isDescendantOf, toNodeMap } from "@/domain/documents/category-tree";
import { toCalendarDate, toIsoDate } from "@/domain/documents/document-dates";
import { expiringWindowEnd } from "@/domain/documents/expiration";
import { buildSearchText, normalizeSearchText } from "@/domain/documents/search-text";
import { prepareTags } from "@/domain/documents/tags";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

const documentSelect = {
  id: true,
  title: true,
  description: true,
  issueDate: true,
  expirationDate: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  responsibleMember: { select: { userId: true, user: { select: { name: true } } } },
  createdByMember: { select: { userId: true, user: { select: { name: true } } } },
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { normalizedName: "asc" } } },
} as const;

type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

const toDocument = (row: DocumentRow): DocumentRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  branch: row.branch,
  department: row.department,
  responsible: row.responsibleMember ? { userId: row.responsibleMember.userId, name: row.responsibleMember.user.name } : null,
  createdBy: row.createdByMember ? { userId: row.createdByMember.userId, name: row.createdByMember.user.name } : null,
  issueDate: row.issueDate ? toIsoDate(row.issueDate) : null,
  expirationDate: row.expirationDate ? toIsoDate(row.expirationDate) : null,
  tags: row.tags.map((link) => link.tag.name),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Coluna `date` do PostgreSQL: meia-noite UTC, sem parte de hora. */
const toDateColumn = (value: string | null) => (value === null ? null : toCalendarDate(value));

const ORDER: Record<DocumentFilter["sort"], Prisma.DocumentOrderByWithRelationInput> = {
  recent: { updatedAt: "desc" },
  title: { title: "asc" },
  created: { createdAt: "desc" },
  // Quem vence antes primeiro; sem validade vai para o fim.
  expiration: { expirationDate: { sort: "asc", nulls: "last" } },
};

/**
 * Situação de vencimento vira intervalo de datas no banco (MASTER SPEC 10.2):
 * a situação é derivada, então nunca há coluna de status para filtrar.
 */
function expirationWhere(filter: DocumentFilter): Prisma.DocumentWhereInput {
  if (filter.expirationStatus === null) return {};

  const today = toCalendarDate(filter.today);
  const windowEnd = toCalendarDate(expiringWindowEnd(filter.today, filter.expiringWindowDays));

  switch (filter.expirationStatus) {
    case "EXPIRED":
      return { expirationDate: { lt: today } };
    case "EXPIRING":
      return { expirationDate: { gte: today, lte: windowEnd } };
    case "VALID":
      return { expirationDate: { gt: windowEnd } };
    case "NO_EXPIRATION":
      return { expirationDate: null };
  }
}

/**
 * Documentos, categorias e etiquetas.
 *
 * Três consequências da exclusão lógica aparecem aqui: toda busca filtra
 * `deletedAt: null`; o `RESTRICT` do banco não impede excluir categoria em uso,
 * então os vínculos são conferidos em transação; e documento excluído mantém
 * suas etiquetas, porque nada é apagado (MASTER SPEC 17.2).
 *
 * As regras de árvore (níveis, ciclo e nome repetido entre irmãs) dependem de
 * ler a árvore inteira antes de gravar. Um `pg_advisory_xact_lock` por empresa
 * serializa essas escritas, senão duas requisições simultâneas passariam cada
 * uma na sua checagem e o resultado violaria a regra.
 */
export function createPrismaDocumentRepository(prisma: PrismaClient): DocumentRepository {
  const lockCategories = (tx: Prisma.TransactionClient, companyId: string) =>
    tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`categories:${companyId}`}))`;

  const liveCategories = (tx: Prisma.TransactionClient, companyId: string) =>
    tx.documentCategory.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
    });

  const countDocumentsByCategory = async (companyId: string) => {
    const rows = await prisma.document.groupBy({
      by: ["categoryId"],
      where: { companyId, deletedAt: null, categoryId: { not: null } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.categoryId as string, row._count._all]));
  };

  const toCategory = (
    row: { id: string; name: string; description: string | null; parentId: string | null; createdAt: Date; updatedAt: Date },
    documentCount: number,
  ): CategoryRecord => ({ ...row, documentCount });

  /**
   * Confere as regras da árvore e devolve nada: quem chama já está na transação
   * com o lock da empresa. `categoryId` nulo significa categoria nova.
   */
  const assertTreeRules = (
    categories: ReadonlyArray<{ id: string; name: string; parentId: string | null }>,
    input: CategoryInput,
    categoryId: string | null,
  ) => {
    const nodes = toNodeMap(categories);

    if (input.parentId !== null) {
      if (!nodes.has(input.parentId)) throw new CategoryNotFoundError();
      if (categoryId !== null && (input.parentId === categoryId || isDescendantOf(input.parentId, categoryId, nodes))) {
        throw new CategoryCycleError();
      }
    }
    if (!fitsUnder(input.parentId, categoryId, nodes)) throw new CategoryDepthExceededError();

    const name = normalizeSearchText(input.name);
    const taken = categories.some(
      (sibling) => sibling.id !== categoryId && sibling.parentId === input.parentId && normalizeSearchText(sibling.name) === name,
    );
    if (taken) throw new CategoryNameTakenError();
  };

  /** Cada referência precisa ser da mesma empresa e estar viva. */
  const assertReferences = async (
    tx: Prisma.TransactionClient,
    companyId: string,
    input: DocumentInput,
    options: { readonly skipResponsible?: boolean } = {},
  ) => {
    const fail = (field: DocumentReferenceField, message: string) => {
      throw new DocumentReferenceError(field, message);
    };

    if (input.categoryId) {
      const category = await tx.documentCategory.findFirst({
        where: { id: input.categoryId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!category) fail("categoryId", "categoria não encontrada");
    }

    if (input.branchId) {
      const branch = await tx.branch.findFirst({
        where: { id: input.branchId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) fail("branchId", "filial não encontrada");
    }

    if (input.departmentId) {
      const department = await tx.department.findFirst({
        where: { id: input.departmentId, companyId, deletedAt: null },
        select: { branchId: true },
      });
      if (!department) fail("departmentId", "setor não encontrado");
      // Setor de uma filial não combina com documento de outra.
      if (department?.branchId && input.branchId && department.branchId !== input.branchId) {
        fail("departmentId", "setor não pertence à filial escolhida");
      }
    }

    if (input.responsibleUserId && !options.skipResponsible) {
      const membership = await tx.membership.findFirst({
        where: { companyId, userId: input.responsibleUserId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (!membership) fail("responsibleUserId", "responsável não encontrado");
    }
  };

  /** Cria as etiquetas que ainda não existem e devolve os ids, na ordem estável. */
  const resolveTags = async (tx: Prisma.TransactionClient, companyId: string, values: readonly string[]) => {
    const prepared = prepareTags(values);
    const ids: string[] = [];

    for (const tag of prepared) {
      const row = await tx.tag.upsert({
        where: { companyId_normalizedName: { companyId, normalizedName: tag.key } },
        create: { companyId, name: tag.name, normalizedName: tag.key },
        // Uma etiqueta já existente mantém a grafia de quem a criou.
        update: {},
        select: { id: true },
      });
      ids.push(row.id);
    }

    return { names: prepared.map((tag) => tag.name), ids };
  };

  const findDocumentRow = async (client: Prisma.TransactionClient | PrismaClient, companyId: string, documentId: string) => {
    const row = await client.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
      select: documentSelect,
    });
    return row ? toDocument(row) : null;
  };

  return {
    async listCategories(companyId) {
      const [rows, counts] = await Promise.all([
        prisma.documentCategory.findMany({
          where: { companyId, deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, description: true, parentId: true, createdAt: true, updatedAt: true },
        }),
        countDocumentsByCategory(companyId),
      ]);
      return rows.map((row) => toCategory(row, counts.get(row.id) ?? 0));
    },

    async findCategory(companyId, categoryId) {
      const row = await prisma.documentCategory.findFirst({
        where: { id: categoryId, companyId, deletedAt: null },
        select: { id: true, name: true, description: true, parentId: true, createdAt: true, updatedAt: true },
      });
      if (!row) return null;

      const documentCount = await prisma.document.count({ where: { companyId, categoryId, deletedAt: null } });
      return toCategory(row, documentCount);
    },

    createCategory(companyId, input) {
      return prisma.$transaction(async (tx) => {
        await lockCategories(tx, companyId);
        assertTreeRules(await liveCategories(tx, companyId), input, null);

        const row = await tx.documentCategory.create({
          data: { companyId, name: input.name, description: input.description, parentId: input.parentId },
          select: { id: true, name: true, description: true, parentId: true, createdAt: true, updatedAt: true },
        });
        return toCategory(row, 0);
      });
    },

    updateCategory(companyId, categoryId, input) {
      return prisma.$transaction(async (tx) => {
        await lockCategories(tx, companyId);

        const categories = await liveCategories(tx, companyId);
        if (!categories.some((category) => category.id === categoryId)) return null;
        assertTreeRules(categories, input, categoryId);

        await tx.documentCategory.updateMany({
          where: { id: categoryId, companyId, deletedAt: null },
          data: { name: input.name, description: input.description, parentId: input.parentId },
        });

        const row = await tx.documentCategory.findFirstOrThrow({
          where: { id: categoryId, companyId },
          select: { id: true, name: true, description: true, parentId: true, createdAt: true, updatedAt: true },
        });
        const documentCount = await tx.document.count({ where: { companyId, categoryId, deletedAt: null } });
        return toCategory(row, documentCount);
      });
    },

    deleteCategory(companyId, categoryId, at) {
      return prisma.$transaction(async (tx) => {
        await lockCategories(tx, companyId);

        const category = await tx.documentCategory.findFirst({
          where: { id: categoryId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (!category) return "not_found" as const;

        // Sequencial de propósito: a transação usa uma conexão só.
        const children = await tx.documentCategory.count({ where: { companyId, parentId: categoryId, deletedAt: null } });
        const documents = await tx.document.count({ where: { companyId, categoryId, deletedAt: null } });
        if (children > 0 || documents > 0) return "in_use" as const;

        await tx.documentCategory.updateMany({ where: { id: categoryId, companyId }, data: { deletedAt: at } });
        return "deleted" as const;
      });
    },

    async listDocuments(companyId, filter) {
      let categoryIds: string[] | null = null;
      if (filter.categoryId) {
        // Filtrar por uma categoria inclui tudo que está abaixo dela.
        const categories = await prisma.documentCategory.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true },
        });
        const nodes = toNodeMap(categories);
        categoryIds = categories
          .filter((category) => category.id === filter.categoryId || isDescendantOf(category.id, filter.categoryId as string, nodes))
          .map((category) => category.id);
      }

      const where: Prisma.DocumentWhereInput = {
        companyId,
        deletedAt: null,
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        ...(filter.responsibleUserId ? { responsibleUserId: filter.responsibleUserId } : {}),
        ...(filter.tag ? { tags: { some: { tag: { normalizedName: filter.tag } } } } : {}),
        ...expirationWhere(filter),
        // Todos os termos precisam aparecer; o texto já está sem acento.
        ...(filter.terms.length > 0 ? { AND: filter.terms.map((term) => ({ searchText: { contains: term } })) } : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.document.findMany({
          where,
          orderBy: [ORDER[filter.sort], { id: "desc" }],
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
          select: documentSelect,
        }),
        prisma.document.count({ where }),
      ]);

      return { items: rows.map(toDocument), total, page: filter.page, pageSize: filter.pageSize };
    },

    findDocument(companyId, documentId) {
      return findDocumentRow(prisma, companyId, documentId);
    },

    createDocument(companyId, input, createdById, at) {
      return prisma.$transaction(async (tx) => {
        await assertReferences(tx, companyId, input);
        const tags = await resolveTags(tx, companyId, input.tags);

        const created = await tx.document.create({
          data: {
            companyId,
            title: input.title,
            description: input.description,
            categoryId: input.categoryId,
            branchId: input.branchId,
            departmentId: input.departmentId,
            responsibleUserId: input.responsibleUserId,
            createdById,
            issueDate: toDateColumn(input.issueDate),
            expirationDate: toDateColumn(input.expirationDate),
            searchText: buildSearchText({ title: input.title, description: input.description, tags: tags.names }),
            createdAt: at,
            updatedAt: at,
          },
          select: { id: true },
        });

        if (tags.ids.length > 0) {
          await tx.documentTag.createMany({
            data: tags.ids.map((tagId) => ({ companyId, documentId: created.id, tagId })),
          });
        }

        return (await findDocumentRow(tx, companyId, created.id)) as DocumentRecord;
      });
    },

    updateDocument(companyId, documentId, input, at) {
      return prisma.$transaction(async (tx) => {
        const current = await tx.document.findFirst({
          where: { id: documentId, companyId, deletedAt: null },
          select: { responsibleUserId: true },
        });
        if (!current) return null;

        // Responsável só é reconferido quando muda: alguém suspenso depois não
        // impede editar o título de um documento que já era dele.
        await assertReferences(tx, companyId, input, {
          skipResponsible: input.responsibleUserId === current.responsibleUserId,
        });
        const tags = await resolveTags(tx, companyId, input.tags);

        await tx.document.updateMany({
          where: { id: documentId, companyId, deletedAt: null },
          data: {
            title: input.title,
            description: input.description,
            categoryId: input.categoryId,
            branchId: input.branchId,
            departmentId: input.departmentId,
            responsibleUserId: input.responsibleUserId,
            issueDate: toDateColumn(input.issueDate),
            expirationDate: toDateColumn(input.expirationDate),
            searchText: buildSearchText({ title: input.title, description: input.description, tags: tags.names }),
            updatedAt: at,
          },
        });

        await tx.documentTag.deleteMany({
          where: { companyId, documentId, ...(tags.ids.length > 0 ? { tagId: { notIn: tags.ids } } : {}) },
        });
        if (tags.ids.length > 0) {
          await tx.documentTag.createMany({
            data: tags.ids.map((tagId) => ({ companyId, documentId, tagId })),
            skipDuplicates: true,
          });
        }

        return findDocumentRow(tx, companyId, documentId);
      });
    },

    async summarizeExpirations(companyId, options) {
      const live: Prisma.DocumentWhereInput = { companyId, deletedAt: null };
      const today = toCalendarDate(options.today);
      const windowEnd = toCalendarDate(options.windowEnd);

      const [total, expired, expiring, withoutExpiration, upcoming] = await Promise.all([
        prisma.document.count({ where: live }),
        prisma.document.count({ where: { ...live, expirationDate: { lt: today } } }),
        prisma.document.count({ where: { ...live, expirationDate: { gte: today, lte: windowEnd } } }),
        prisma.document.count({ where: { ...live, expirationDate: null } }),
        prisma.document.findMany({
          where: { ...live, expirationDate: { lte: windowEnd } },
          orderBy: [{ expirationDate: "asc" }, { id: "desc" }],
          take: options.limit,
          select: documentSelect,
        }),
      ]);

      return {
        counts: {
          valid: total - expired - expiring - withoutExpiration,
          expiring,
          expired,
          withoutExpiration,
          total,
        },
        upcoming: upcoming.map(toDocument),
      };
    },

    async renewDocument(companyId, documentId, input, at) {
      const { count } = await prisma.document.updateMany({
        where: { id: documentId, companyId, deletedAt: null },
        data: {
          issueDate: toDateColumn(input.issueDate),
          expirationDate: toDateColumn(input.expirationDate),
          updatedAt: at,
        },
      });
      return count === 0 ? null : findDocumentRow(prisma, companyId, documentId);
    },

    async deleteDocument(companyId, documentId, at) {
      const { count } = await prisma.document.updateMany({
        where: { id: documentId, companyId, deletedAt: null },
        data: { deletedAt: at },
      });
      return count > 0;
    },

    async listTags(companyId) {
      const counts = await prisma.documentTag.groupBy({
        by: ["tagId"],
        where: { companyId, document: { deletedAt: null } },
        _count: { _all: true },
      });
      if (counts.length === 0) return [];

      const tags = await prisma.tag.findMany({
        where: { companyId, id: { in: counts.map((row) => row.tagId) } },
        orderBy: { normalizedName: "asc" },
        select: { id: true, name: true },
      });
      const byId = new Map(counts.map((row) => [row.tagId, row._count._all]));
      return tags.map((tag) => ({ name: tag.name, documentCount: byId.get(tag.id) ?? 0 }));
    },
  };
}
