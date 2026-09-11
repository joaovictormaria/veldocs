import type { DashboardRepository } from "@/application/ports/dashboard-repository";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids de auditoria são texto livre: só uuid válido vai para uma coluna `uuid`. */
const uuidsOf = (rows: ReadonlyArray<{ entityType: string | null; entityId: string | null }>, type: string) => [
  ...new Set(
    rows
      .filter((row) => row.entityType === type && row.entityId !== null && UUID.test(row.entityId))
      .map((row) => row.entityId as string),
  ),
];

/** Leituras agregadas do painel. Toda consulta filtra pela empresa recebida. */
export function createPrismaDashboardRepository(prisma: PrismaClient): DashboardRepository {
  return {
    async documentStats(companyId, since) {
      const live: Prisma.DocumentWhereInput = { companyId, deletedAt: null };
      const [total, withoutCategory, withoutResponsible, withoutExpiration, createdSince] = await Promise.all([
        prisma.document.count({ where: live }),
        prisma.document.count({ where: { ...live, categoryId: null } }),
        prisma.document.count({ where: { ...live, responsibleUserId: null } }),
        prisma.document.count({ where: { ...live, expirationDate: null } }),
        prisma.document.count({ where: { ...live, createdAt: { gte: since } } }),
      ]);
      return { total, withoutCategory, withoutResponsible, withoutExpiration, createdSince };
    },

    async documentsByCategory(companyId, limit) {
      const groups = await prisma.document.groupBy({
        by: ["categoryId"],
        where: { companyId, deletedAt: null },
        _count: { _all: true },
      });

      const sorted = [...groups].sort((a, b) => b._count._all - a._count._all);
      const top = sorted.slice(0, limit);
      const others = sorted.slice(limit).reduce((sum, group) => sum + group._count._all, 0);

      const ids = top.map((group) => group.categoryId).filter((id): id is string => id !== null);
      const names = new Map(
        (
          await prisma.documentCategory.findMany({
            where: { companyId, id: { in: ids } },
            select: { id: true, name: true },
          })
        ).map((category) => [category.id, category.name]),
      );

      return {
        items: top.map((group) => ({
          categoryId: group.categoryId,
          name: group.categoryId === null ? null : (names.get(group.categoryId) ?? null),
          count: group._count._all,
        })),
        others,
      };
    },

    async recentActivity(companyId, actions, limit) {
      const rows = await prisma.auditLog.findMany({
        where: { companyId, action: { in: [...actions] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actorUser: { select: { name: true } },
        },
      });

      // Nomes resolvidos em lote e só da própria empresa; registros excluídos
      // continuam com nome, para a atividade dizer o que foi excluído.
      const [documents, categories, branches, departments] = await Promise.all([
        prisma.document.findMany({
          where: { companyId, id: { in: uuidsOf(rows, "Document") } },
          select: { id: true, title: true },
        }),
        prisma.documentCategory.findMany({
          where: { companyId, id: { in: uuidsOf(rows, "DocumentCategory") } },
          select: { id: true, name: true },
        }),
        prisma.branch.findMany({
          where: { companyId, id: { in: uuidsOf(rows, "Branch") } },
          select: { id: true, name: true },
        }),
        prisma.department.findMany({
          where: { companyId, id: { in: uuidsOf(rows, "Department") } },
          select: { id: true, name: true },
        }),
      ]);

      const names = new Map<string, string>([
        ...documents.map((item) => [`Document:${item.id}`, item.title] as const),
        ...categories.map((item) => [`DocumentCategory:${item.id}`, item.name] as const),
        ...branches.map((item) => [`Branch:${item.id}`, item.name] as const),
        ...departments.map((item) => [`Department:${item.id}`, item.name] as const),
      ]);

      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorName: row.actorUser?.name ?? null,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: names.get(`${row.entityType}:${row.entityId}`) ?? null,
        createdAt: row.createdAt,
      }));
    },
  };
}
