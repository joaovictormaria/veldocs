import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createDashboardQueries } from "@/application/dashboard/dashboard-queries";
import { createCategoryManagement } from "@/application/documents/manage-categories";
import { createDocumentManagement } from "@/application/documents/manage-documents";
import { createExpirationManagement } from "@/application/documents/manage-expirations";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaDashboardRepository } from "@/infrastructure/database/prisma-dashboard-repository";
import { createPrismaDocumentRepository } from "@/infrastructure/database/prisma-document-repository";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";

const now = new Date("2026-09-11T12:00:00.000Z");
const request = { ipAddress: "203.0.113.95", userAgent: "vitest" };

let prisma: PrismaClient;
let tenant: Awaited<ReturnType<typeof createTenantFixture>>;
let other: Awaited<ReturnType<typeof createTenantFixture>>;
let context: AuthorizedContext;
let documents: ReturnType<typeof createDocumentManagement>;
let categories: ReturnType<typeof createCategoryManagement>;
let dashboard: ReturnType<typeof createDashboardQueries>;

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

const contextFor = (companyId: string, userId: string, permissions: string[]): AuthorizedContext => ({
  companyId,
  userId,
  roleKeys: ["GESTOR"],
  permissions,
});

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  tenant = await createTenantFixture(prisma, `d${randomUUID().slice(0, 4)}`);
  other = await createTenantFixture(prisma, `e${randomUUID().slice(0, 4)}`);
  context = contextFor(tenant.company.id, tenant.user.id, ["documents.read", "audit.read"]);

  const deps = { repository: createPrismaDocumentRepository(prisma), audit: createPrismaAuditLogger(prisma), now: () => now };
  documents = createDocumentManagement(deps);
  categories = createCategoryManagement(deps);
  dashboard = createDashboardQueries({
    repository: createPrismaDashboardRepository(prisma),
    expirations: createExpirationManagement(deps),
    now: () => now,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("painel com PostgreSQL", () => {
  it("conta o cadastro documental, inclusive o que está incompleto", async () => {
    await documents.create(
      context,
      { title: "Completo", categoryId: tenant.category.id, responsibleUserId: tenant.user.id, expirationDate: "2027-01-01" },
      request,
    );
    await documents.create(context, { title: "Sem nada" }, request);
    const excluido = unwrap(await documents.create(context, { title: "Excluído" }, request));
    await documents.remove(context, excluido.id, request);

    // Documento antigo, criado antes da janela de 30 dias.
    await prisma.document.create({
      data: { companyId: tenant.company.id, title: "Antigo", createdAt: new Date("2026-06-01T12:00:00.000Z") },
    });

    const summary = await dashboard.summary(context, { expirations: false });

    expect(summary.documents).toEqual({
      total: 3,
      withoutCategory: 2,
      withoutResponsible: 2,
      withoutExpiration: 2,
      // Os dois criados "agora" entram; o antigo e o excluído, não.
      createdLast30Days: 2,
    });
  });

  it("agrupa por categoria, com os documentos sem categoria e o restante somado", async () => {
    const repository = createPrismaDashboardRepository(prisma);
    const fiscal = unwrap(await categories.create(context, { name: "Fiscal" }, request));
    const pessoal = unwrap(await categories.create(context, { name: "Pessoal" }, request));

    for (let i = 0; i < 3; i += 1) await documents.create(context, { title: `Fiscal ${i}`, categoryId: fiscal.id }, request);
    for (let i = 0; i < 2; i += 1) await documents.create(context, { title: `Solto ${i}` }, request);
    await documents.create(context, { title: "Pessoal", categoryId: pessoal.id }, request);
    await documents.create(context, { title: "Licença", categoryId: tenant.category.id }, request);

    const top2 = await repository.documentsByCategory(tenant.company.id, 2);

    expect(top2.items).toEqual([
      { categoryId: fiscal.id, name: "Fiscal", count: 3 },
      { categoryId: null, name: null, count: 2 },
    ]);
    expect(top2.others).toBe(2);
  });

  it("atividade recente traz nomes, esconde eventos de acesso e não vaza outra empresa", async () => {
    const alvara = unwrap(await documents.create(context, { title: "Alvará" }, request));
    await categories.create(context, { name: "Fiscal" }, request);
    await documents.remove(context, alvara.id, request);

    await prisma.auditLog.create({
      data: { companyId: tenant.company.id, actorUserId: tenant.user.id, action: "auth.login_succeeded" },
    });
    await prisma.auditLog.create({
      data: {
        companyId: other.company.id,
        actorUserId: other.user.id,
        action: "document.created",
        entityType: "Document",
        entityId: randomUUID(),
      },
    });

    const summary = await dashboard.summary(context, { expirations: false });

    expect(summary.activity?.map((event) => [event.action, event.actorName, event.entityName]).sort()).toEqual(
      [
        ["category.created", tenant.user.name, "Fiscal"],
        ["document.created", tenant.user.name, "Alvará"],
        // Documento excluído continua com nome: a atividade diz o que foi excluído.
        ["document.deleted", tenant.user.name, "Alvará"],
      ].sort(),
    );
  });

  it("id de auditoria que não é uuid não quebra a leitura", async () => {
    await prisma.auditLog.create({
      data: {
        companyId: tenant.company.id,
        actorUserId: tenant.user.id,
        action: "document.updated",
        entityType: "Document",
        entityId: "nao-e-uuid",
      },
    });

    const summary = await dashboard.summary(context, { expirations: false });

    expect(summary.activity).toEqual([expect.objectContaining({ action: "document.updated", entityName: null })]);
  });

  it("vencimentos só com o módulo, e sem auditoria não há atividade", async () => {
    await documents.create(context, { title: "Vencido", expirationDate: "2026-09-01" }, request);
    await documents.create(context, { title: "Em dia", expirationDate: "2027-09-01" }, request);

    const semModulo = await dashboard.summary(context, { expirations: false });
    expect(semModulo.expirations).toBeNull();

    const comModulo = await dashboard.summary(
      contextFor(tenant.company.id, tenant.user.id, ["documents.read"]),
      { expirations: true },
    );
    expect(comModulo.expirations?.counts).toMatchObject({ expired: 1, valid: 1 });
    expect(comModulo.expirations?.upcoming.map((item) => item.title)).toEqual(["Vencido"]);
    expect(comModulo.activity).toBeNull();
  });

  it("outra empresa vê o próprio painel vazio", async () => {
    await documents.create(context, { title: "Só da empresa A" }, request);

    const summary = await dashboard.summary(contextFor(other.company.id, other.user.id, ["documents.read", "audit.read"]), {
      expirations: false,
    });

    expect(summary.documents.total).toBe(0);
    expect(summary.categories).toEqual({ items: [], others: 0 });
    expect(summary.activity).toEqual([]);
  });
});
