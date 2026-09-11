import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createCategoryManagement } from "@/application/documents/manage-categories";
import { createDocumentManagement } from "@/application/documents/manage-documents";
import type { DocumentPage, DocumentRecord } from "@/application/ports/document-repository";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaDocumentRepository } from "@/infrastructure/database/prisma-document-repository";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";

const now = new Date("2026-09-11T12:00:00.000Z");
const request = { ipAddress: "203.0.113.80", userAgent: "vitest" };

let prisma: PrismaClient;
let documents: ReturnType<typeof createDocumentManagement>;
let categories: ReturnType<typeof createCategoryManagement>;
let tenant: Awaited<ReturnType<typeof createTenantFixture>>;
let other: Awaited<ReturnType<typeof createTenantFixture>>;
let context: AuthorizedContext;

const contextFor = (companyId: string, userId: string): AuthorizedContext => ({
  companyId,
  userId,
  roleKeys: ["ADMIN"],
  permissions: ["categories.manage", "documents.create", "documents.update", "documents.delete"],
});

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

const refuse = (result: { ok: true } | { ok: false; reason: string; issues?: unknown }) => {
  if (result.ok) throw new Error("esperava recusa");
  return result;
};

const titles = (page: DocumentPage) => page.items.map((item) => item.title);

const createDocument = async (input: Record<string, unknown>): Promise<DocumentRecord> =>
  unwrap(await documents.create(context, input, request));

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  tenant = await createTenantFixture(prisma, `a${randomUUID().slice(0, 4)}`);
  other = await createTenantFixture(prisma, `b${randomUUID().slice(0, 4)}`);
  context = contextFor(tenant.company.id, tenant.user.id);

  const deps = {
    repository: createPrismaDocumentRepository(prisma),
    audit: createPrismaAuditLogger(prisma),
    now: () => now,
  };
  documents = createDocumentManagement(deps);
  categories = createCategoryManagement(deps);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("documentos com PostgreSQL", () => {
  it("cria com todos os vínculos, datas e etiquetas, e registra a auditoria", async () => {
    const document = await createDocument({
      title: "Alvará de Funcionamento",
      description: "Emitido pela prefeitura",
      categoryId: tenant.category.id,
      branchId: tenant.branch.id,
      departmentId: tenant.department.id,
      responsibleUserId: tenant.user.id,
      issueDate: "2026-01-10",
      expirationDate: "2027-01-09",
      tags: ["Fiscal", "fiscal", "Urgente"],
    });

    expect(document).toMatchObject({
      title: "Alvará de Funcionamento",
      category: { id: tenant.category.id, name: tenant.category.name },
      branch: { id: tenant.branch.id, name: tenant.branch.name },
      department: { id: tenant.department.id, name: tenant.department.name },
      responsible: { userId: tenant.user.id, name: tenant.user.name },
      createdBy: { userId: tenant.user.id },
      issueDate: "2026-01-10",
      expirationDate: "2027-01-09",
      tags: ["Fiscal", "Urgente"],
    });

    const saved = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(saved.searchText).toBe("alvara de funcionamento emitido pela prefeitura fiscal urgente");
    // Datas de calendário não escorregam de dia por causa de fuso.
    expect(saved.issueDate?.toISOString()).toBe("2026-01-10T00:00:00.000Z");

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "document.created" } });
    expect(log.entityId).toBe(document.id);
    expect(log.metadata).toMatchObject({ responsibleUserId: tenant.user.id, tagCount: 2, hasExpiration: true });
  });

  it("recusa vínculo de outra empresa apontando o campo, sem criar nada", async () => {
    const cases: Array<[string, string]> = [
      ["categoryId", other.category.id],
      ["branchId", other.branch.id],
      ["departmentId", other.department.id],
      ["responsibleUserId", other.user.id],
    ];

    for (const [field, id] of cases) {
      const result = refuse(await documents.create(context, { title: "Invasor", [field]: id }, request));
      expect(result.reason, field).toBe("invalid_input");
      expect((result.issues as Array<{ field: string }>)[0]?.field, field).toBe(field);
    }

    expect(await prisma.document.count({ where: { companyId: tenant.company.id } })).toBe(0);
  });

  it("recusa setor de outra filial da mesma empresa", async () => {
    const outra = await prisma.branch.create({ data: { companyId: tenant.company.id, name: "Filial Sul" } });

    const result = refuse(
      await documents.create(
        context,
        { title: "Contrato", branchId: outra.id, departmentId: tenant.department.id },
        request,
      ),
    );

    expect(result.issues).toEqual([{ field: "departmentId", message: "setor não pertence à filial escolhida" }]);
  });

  it("responsável precisa ser membro ativo, mas quem já era responsável não trava a edição", async () => {
    const document = await createDocument({ title: "Contrato", responsibleUserId: tenant.user.id });
    await prisma.membership.update({
      where: { companyId_userId: { companyId: tenant.company.id, userId: tenant.user.id } },
      data: { status: "SUSPENDED" },
    });

    // Mesmo responsável: a edição continua possível.
    const updated = unwrap(
      await documents.update(context, document.id, { title: "Contrato revisado", responsibleUserId: tenant.user.id }, request),
    );
    expect(updated.title).toBe("Contrato revisado");

    // Passar a responsabilidade para alguém suspenso, não.
    const outro = await createDocument({ title: "Outro" });
    expect(
      refuse(await documents.update(context, outro.id, { title: "Outro", responsibleUserId: tenant.user.id }, request)).issues,
    ).toEqual([{ field: "responsibleUserId", message: "responsável não encontrado" }]);
  });

  it("busca ignora acento e exige todos os termos", async () => {
    await createDocument({ title: "Certidão Negativa de Débitos" });
    await createDocument({ title: "Certidão de Regularidade" });

    expect(titles(unwrap(await documents.list(context, { q: "certidao" })))).toHaveLength(2);
    expect(titles(unwrap(await documents.list(context, { q: "CERTIDÃO débitos" })))).toEqual([
      "Certidão Negativa de Débitos",
    ]);
    expect(titles(unwrap(await documents.list(context, { q: "certidao inexistente" })))).toEqual([]);
  });

  it("encontra pela descrição e pela etiqueta", async () => {
    await createDocument({ title: "Contrato", description: "Fornecedor Acme", tags: ["Jurídico"] });

    expect(titles(unwrap(await documents.list(context, { q: "acme" })))).toEqual(["Contrato"]);
    expect(titles(unwrap(await documents.list(context, { q: "juridico" })))).toEqual(["Contrato"]);
    expect(titles(unwrap(await documents.list(context, { tag: "JURIDICO" })))).toEqual(["Contrato"]);
  });

  it("filtra por categoria trazendo também as subcategorias", async () => {
    const pai = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: pai.id }, request));

    await createDocument({ title: "Política de RH", categoryId: pai.id });
    await createDocument({ title: "Ficha de admissão", categoryId: filha.id });
    await createDocument({ title: "Alvará", categoryId: tenant.category.id });

    expect(titles(unwrap(await documents.list(context, { categoryId: pai.id, sort: "title" })))).toEqual([
      "Ficha de admissão",
      "Política de RH",
    ]);
    expect(titles(unwrap(await documents.list(context, { categoryId: filha.id })))).toEqual(["Ficha de admissão"]);
  });

  it("filtra por filial, setor e responsável", async () => {
    await createDocument({ title: "Da matriz", branchId: tenant.branch.id, departmentId: tenant.department.id });
    await createDocument({ title: "Sem vínculo" });
    await createDocument({ title: "Com responsável", responsibleUserId: tenant.user.id });

    expect(titles(unwrap(await documents.list(context, { branchId: tenant.branch.id })))).toEqual(["Da matriz"]);
    expect(titles(unwrap(await documents.list(context, { departmentId: tenant.department.id })))).toEqual(["Da matriz"]);
    expect(titles(unwrap(await documents.list(context, { responsibleUserId: tenant.user.id })))).toEqual([
      "Com responsável",
    ]);
  });

  it("pagina e ordena", async () => {
    for (const title of ["Alfa", "Bravo", "Charlie"]) await createDocument({ title });

    const first = unwrap(await documents.list(context, { sort: "title", page: "1", pageSize: "2" }));
    expect(titles(first)).toEqual(["Alfa", "Bravo"]);
    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });

    const second = unwrap(await documents.list(context, { sort: "title", page: "2", pageSize: "2" }));
    expect(titles(second)).toEqual(["Charlie"]);
  });

  it("exclusão é lógica: some das listagens, mas nada é apagado", async () => {
    const document = await createDocument({ title: "Alvará", tags: ["Fiscal"] });

    expect(await documents.remove(context, document.id, request)).toEqual({ ok: true, data: null });

    expect(titles(unwrap(await documents.list(context, {})))).toEqual([]);
    expect(await documents.find(context, document.id)).toBeNull();

    const row = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(row.deletedAt).toEqual(now);
    // As etiquetas continuam ligadas ao documento excluído.
    expect(await prisma.documentTag.count({ where: { documentId: document.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "document.deleted" } })).toBe(1);
  });

  it("documento de outra empresa se comporta como inexistente", async () => {
    const alheio = await prisma.document.create({
      data: { companyId: other.company.id, title: "Da empresa B" },
    });

    expect(await documents.find(context, alheio.id)).toBeNull();
    expect(await documents.update(context, alheio.id, { title: "Invadido" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await documents.remove(context, alheio.id, request)).toEqual({ ok: false, reason: "not_found" });

    const untouched = await prisma.document.findUniqueOrThrow({ where: { id: alheio.id } });
    expect(untouched).toMatchObject({ title: "Da empresa B", deletedAt: null });
  });
});

describe("etiquetas com PostgreSQL", () => {
  it("reaproveita a mesma etiqueta entre documentos, sem duplicar por acento ou maiúscula", async () => {
    await createDocument({ title: "Um", tags: ["Fiscal"] });
    await createDocument({ title: "Dois", tags: ["fiscal", "Órgão"] });

    expect(await prisma.tag.count({ where: { companyId: tenant.company.id } })).toBe(2);
    expect(await documents.listTags(context)).toEqual([
      { name: "Fiscal", documentCount: 2 },
      { name: "Órgão", documentCount: 1 },
    ]);
  });

  it("cada empresa tem as suas etiquetas", async () => {
    await createDocument({ title: "Um", tags: ["Fiscal"] });

    const outroContexto = contextFor(other.company.id, other.user.id);
    expect(await documents.listTags(outroContexto)).toEqual([]);
  });

  it("editar troca as etiquetas e a listagem só conta documentos vivos", async () => {
    const document = await createDocument({ title: "Contrato", tags: ["Fiscal", "Urgente"] });

    const updated = unwrap(await documents.update(context, document.id, { title: "Contrato", tags: ["Urgente"] }, request));
    expect(updated.tags).toEqual(["Urgente"]);
    expect(await documents.listTags(context)).toEqual([{ name: "Urgente", documentCount: 1 }]);

    await documents.remove(context, document.id, request);
    expect(await documents.listTags(context)).toEqual([]);
  });
});

describe("categorias com PostgreSQL", () => {
  it("aceita três níveis e recusa o quarto", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: raiz.id }, request));
    const neta = unwrap(await categories.create(context, { name: "Exames", parentId: filha.id }, request));

    const result = refuse(await categories.create(context, { name: "Demais", parentId: neta.id }, request));
    expect(result.issues).toEqual([{ field: "parentId", message: "as categorias vão até 3 níveis" }]);

    expect((await categories.find(context, neta.id))?.path).toEqual(["Pessoal", "Admissão", "Exames"]);
  });

  it("recusa nome repetido entre irmãs, mas aceita em ramos diferentes", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    await categories.create(context, { name: "Contratos", parentId: raiz.id }, request);

    expect(await categories.create(context, { name: "contratos", parentId: raiz.id }, request)).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect((await categories.create(context, { name: "Contratos" }, request)).ok).toBe(true);
  });

  it("não deixa uma categoria virar descendente de si mesma", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: raiz.id }, request));

    for (const parentId of [raiz.id, filha.id]) {
      const result = refuse(await categories.update(context, raiz.id, { name: "Pessoal", parentId }, request));
      expect(result.issues).toEqual([{ field: "parentId", message: "uma categoria não pode ficar dentro dela mesma" }]);
    }
  });

  it("mover leva a subárvore junto e respeita o limite de níveis", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: raiz.id }, request));
    await categories.create(context, { name: "Exames", parentId: filha.id }, request);
    const outra = unwrap(await categories.create(context, { name: "Fiscal" }, request));
    const dentro = unwrap(await categories.create(context, { name: "Notas", parentId: outra.id }, request));

    // "Pessoal" tem 3 níveis: não cabe embaixo de ninguém.
    expect(refuse(await categories.update(context, raiz.id, { name: "Pessoal", parentId: outra.id }, request)).issues).toEqual(
      [{ field: "parentId", message: "as categorias vão até 3 níveis" }],
    );
    // "Notas" é folha: cabe embaixo de "Admissão".
    expect((await categories.update(context, dentro.id, { name: "Notas", parentId: filha.id }, request)).ok).toBe(true);
    expect((await categories.find(context, dentro.id))?.path).toEqual(["Pessoal", "Admissão", "Notas"]);
  });

  it("não exclui categoria com filha ou documento, e conta os documentos", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: raiz.id }, request));

    expect(await categories.remove(context, raiz.id, request)).toEqual({ ok: false, reason: "in_use" });

    await createDocument({ title: "Ficha", categoryId: filha.id });
    expect(await categories.remove(context, filha.id, request)).toEqual({ ok: false, reason: "in_use" });
    expect((await categories.find(context, filha.id))?.documentCount).toBe(1);

    expect(await prisma.auditLog.count({ where: { action: "category.deleted" } })).toBe(0);
  });

  it("exclui categoria livre e libera o nome para reuso", async () => {
    const category = unwrap(await categories.create(context, { name: "Temporária" }, request));

    expect(await categories.remove(context, category.id, request)).toEqual({ ok: true, data: null });
    expect(await prisma.documentCategory.findUniqueOrThrow({ where: { id: category.id } })).toMatchObject({
      deletedAt: now,
    });
    expect((await categories.create(context, { name: "Temporária" }, request)).ok).toBe(true);
  });

  it("categoria de outra empresa se comporta como inexistente", async () => {
    expect(await categories.find(context, other.category.id)).toBeNull();
    expect(await categories.update(context, other.category.id, { name: "Invadida" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await categories.remove(context, other.category.id, request)).toEqual({ ok: false, reason: "not_found" });
    expect(
      refuse(await categories.create(context, { name: "Filha", parentId: other.category.id }, request)).issues,
    ).toEqual([{ field: "parentId", message: "categoria superior não encontrada" }]);
  });
});
