import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createDocumentManagement } from "@/application/documents/manage-documents";
import { createExpirationManagement } from "@/application/documents/manage-expirations";
import type { DocumentRecord } from "@/application/ports/document-repository";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaDocumentRepository } from "@/infrastructure/database/prisma-document-repository";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTenantFixture, createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

/** 11/09/2026, 09:00 em Brasília: o "hoje" de todos os testes deste arquivo. */
const now = new Date("2026-09-11T12:00:00.000Z");
const HOJE = "2026-09-11";
const PASSWORD = "uma frase longa e secreta";
const request = { ipAddress: "203.0.113.90", userAgent: "vitest" };

let prisma: PrismaClient;
let documents: ReturnType<typeof createDocumentManagement>;
let expirations: ReturnType<typeof createExpirationManagement>;
let tenant: Awaited<ReturnType<typeof createTenantFixture>>;
let context: AuthorizedContext;

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

const refuse = (result: { ok: true } | { ok: false; reason: string; issues?: unknown }) => {
  if (result.ok) throw new Error("esperava recusa");
  return result;
};

const criar = async (title: string, expirationDate: string | null): Promise<DocumentRecord> =>
  unwrap(await documents.create(context, { title, expirationDate }, request));

const titulos = (items: ReadonlyArray<{ title: string }>) => items.map((item) => item.title);

const listar = async (query: Record<string, unknown>) =>
  unwrap(await documents.list(context, query, { expirations: true }));

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  tenant = await createTenantFixture(prisma, `v${randomUUID().slice(0, 4)}`);
  context = {
    companyId: tenant.company.id,
    userId: tenant.user.id,
    roleKeys: ["GESTOR"],
    permissions: ["documents.create", "documents.read", "expirations.read", "expirations.manage"],
  };

  const deps = {
    repository: createPrismaDocumentRepository(prisma),
    audit: createPrismaAuditLogger(prisma),
    now: () => now,
  };
  documents = createDocumentManagement(deps);
  expirations = createExpirationManagement(deps);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Um documento de cada situação, sempre em relação a 11/09/2026. */
async function cenarioCompleto() {
  return {
    vencido: await criar("Alvará vencido", "2026-09-01"),
    venceHoje: await criar("Certidão que vence hoje", HOJE),
    vencendo: await criar("Contrato vencendo", "2026-10-01"),
    valido: await criar("Apólice válida", "2027-01-01"),
    semValidade: await criar("Manual interno", null),
  };
}

describe("situação de vencimento com PostgreSQL", () => {
  it("classifica cada documento pela validade", async () => {
    await cenarioCompleto();

    const page = await listar({ sort: "expiration" });

    expect(page.items.map((item) => [item.title, item.expirationStatus])).toEqual([
      ["Alvará vencido", "EXPIRED"],
      ["Certidão que vence hoje", "EXPIRING"],
      ["Contrato vencendo", "EXPIRING"],
      ["Apólice válida", "VALID"],
      // Sem validade fica por último na ordenação por vencimento.
      ["Manual interno", "NO_EXPIRATION"],
    ]);
  });

  it("filtra por situação usando intervalos de data no banco", async () => {
    await cenarioCompleto();

    expect(titulos((await listar({ status: "EXPIRED" })).items)).toEqual(["Alvará vencido"]);
    expect(titulos((await listar({ status: "EXPIRING", sort: "expiration" })).items)).toEqual([
      "Certidão que vence hoje",
      "Contrato vencendo",
    ]);
    expect(titulos((await listar({ status: "VALID" })).items)).toEqual(["Apólice válida"]);
    expect(titulos((await listar({ status: "NO_EXPIRATION" })).items)).toEqual(["Manual interno"]);
  });

  it("a situação combina com os outros filtros", async () => {
    await cenarioCompleto();
    await criar("Alvará vencido da obra", "2026-08-01");

    const page = await listar({ status: "EXPIRED", q: "obra" });

    expect(titulos(page.items)).toEqual(["Alvará vencido da obra"]);
    expect(page.total).toBe(1);
  });

  it("sem o módulo, a listagem não traz situação nem filtra por ela", async () => {
    await cenarioCompleto();

    const page = unwrap(await documents.list(context, { status: "EXPIRED" }));

    expect(page.total).toBe(6 - 1);
    expect(page.items.every((item) => item.expirationStatus === undefined)).toBe(true);
  });
});

describe("painel de vencimentos com PostgreSQL", () => {
  it("conta por situação e lista os mais urgentes primeiro", async () => {
    await cenarioCompleto();

    const summary = unwrap(await expirations.summary(context, {}));

    expect(summary).toMatchObject({
      today: HOJE,
      windowDays: 30,
      counts: { valid: 1, expiring: 2, expired: 1, withoutExpiration: 1, total: 5 },
    });
    expect(summary.upcoming.map((item) => [item.title, item.daysRemaining])).toEqual([
      ["Alvará vencido", -10],
      ["Certidão que vence hoje", 0],
      ["Contrato vencendo", 20],
    ]);
  });

  it("janela menor muda quem está 'vencendo'", async () => {
    await cenarioCompleto();

    const summary = unwrap(await expirations.summary(context, { days: 7 }));

    expect(summary.counts).toMatchObject({ expiring: 1, valid: 2, expired: 1 });
    expect(titulos(summary.upcoming)).toEqual(["Alvará vencido", "Certidão que vence hoje"]);
  });

  it("documento excluído sai das contas", async () => {
    const { vencido } = await cenarioCompleto();
    await documents.remove(context, vencido.id, request);

    const summary = unwrap(await expirations.summary(context, {}));

    expect(summary.counts).toMatchObject({ expired: 0, total: 4 });
    expect(titulos(summary.upcoming)).not.toContain("Alvará vencido");
  });

  it("cada empresa vê só os seus", async () => {
    await cenarioCompleto();
    const outra = await createTenantFixture(prisma, `o${randomUUID().slice(0, 4)}`);

    const summary = unwrap(
      await expirations.summary({ ...context, companyId: outra.company.id, userId: outra.user.id }, {}),
    );

    expect(summary.counts).toMatchObject({ total: 0, expired: 0, expiring: 0 });
    expect(summary.upcoming).toEqual([]);
  });
});

describe("renovação com PostgreSQL", () => {
  it("avança as datas, mantém o resto e registra a auditoria", async () => {
    const documento = unwrap(
      await documents.create(
        context,
        {
          title: "Alvará de Funcionamento",
          categoryId: tenant.category.id,
          tags: ["Prefeitura"],
          issueDate: "2025-09-01",
          expirationDate: "2026-09-01",
        },
        request,
      ),
    );

    const renovado = unwrap(
      await expirations.renew(context, documento.id, { issueDate: HOJE, expirationDate: "2027-09-10" }, request),
    );

    expect(renovado).toMatchObject({
      title: "Alvará de Funcionamento",
      category: { id: tenant.category.id },
      tags: ["Prefeitura"],
      issueDate: HOJE,
      expirationDate: "2027-09-10",
    });
    expect((await listar({ status: "VALID" })).items.map((item) => item.id)).toEqual([documento.id]);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "document.renewed" } });
    expect(log.entityId).toBe(documento.id);
    expect(log.metadata).toEqual({
      previousIssueDate: "2025-09-01",
      previousExpirationDate: "2026-09-01",
      issueDate: HOJE,
      expirationDate: "2027-09-10",
    });
  });

  it("não anda para trás nem alcança documento de outra empresa", async () => {
    const documento = await criar("Certidão", "2026-12-01");

    expect(refuse(await expirations.renew(context, documento.id, { expirationDate: "2026-11-30" }, request)).issues).toEqual(
      [{ field: "expirationDate", message: "a nova validade precisa ser posterior à atual" }],
    );

    const outra = await createTenantFixture(prisma, `p${randomUUID().slice(0, 4)}`);
    const alheio = { ...context, companyId: outra.company.id, userId: outra.user.id };
    expect(await expirations.renew(alheio, documento.id, { expirationDate: "2028-01-01" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });

    const inalterado = await prisma.document.findUniqueOrThrow({ where: { id: documento.id } });
    expect(inalterado.expirationDate?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(await prisma.auditLog.count({ where: { action: "document.renewed" } })).toBe(0);
  });
});

describe("entitlement do módulo Controle de vencimentos", () => {
  /** Empresa com um GESTOR (não exige MFA) para exercitar a autorização real. */
  async function empresaComGestor(auth: ReturnType<typeof createTestAuthServices>) {
    const owner = await auth.register(
      {
        name: "Dona",
        email: `dona-${randomUUID().slice(0, 8)}@example.com`,
        password: PASSWORD,
        companyName: "Empresa Vencimentos",
      },
      request,
    );
    if (!owner.ok) throw new Error(`cadastro falhou: ${owner.reason}`);

    const email = `gestor-${randomUUID().slice(0, 8)}@example.com`;
    const user = await prisma.user.create({
      data: { email, name: "Gestor", passwordHash: await createArgon2PasswordHasher().hash(PASSWORD) },
    });
    await prisma.membership.create({ data: { companyId: owner.companyId, userId: user.id, status: "ACTIVE" } });
    const role = await prisma.role.findUniqueOrThrow({
      where: { companyId_key: { companyId: owner.companyId, key: "GESTOR" } },
    });
    await prisma.userRole.create({ data: { companyId: owner.companyId, userId: user.id, roleId: role.id } });

    const login = await auth.login({ identifier: email, password: PASSWORD }, request);
    if (!login.ok) throw new Error("login falhou");
    return { companyId: owner.companyId, token: login.session.token };
  }

  it("GESTOR tem a permissão, mas ela só vale com o módulo contratado", async () => {
    const auth = createTestAuthServices(prisma, () => now);
    const { token } = await empresaComGestor(auth);

    // Sem assinatura: o Core funciona, o módulo pago não.
    await expect(auth.authorize(token, "documents.read")).resolves.toMatchObject({ ok: true });
    await expect(auth.authorize(token, "expirations.read")).resolves.toEqual({
      ok: false,
      reason: "module_not_enabled",
    });
    await expect(auth.authorize(token, "expirations.manage")).resolves.toEqual({
      ok: false,
      reason: "module_not_enabled",
    });
  });

  it("com o módulo no trial, a autorização passa; sem ele no kit, continua bloqueada", async () => {
    const auth = createTestAuthServices(prisma, () => now);
    const { token } = await empresaComGestor(auth);
    const billing = await auth.authorize(token, "documents.read");
    if (!billing.ok) throw new Error("autorização falhou");

    const started = await auth.subscriptions.startTrial(billing.context, { modules: ["vencimentos"] }, request);
    if (!started.ok) throw new Error(`trial falhou: ${started.reason}`);

    await expect(auth.authorize(token, "expirations.read")).resolves.toMatchObject({ ok: true });

    // Trocar para uma escolha sem o módulo bloqueia de novo, sem apagar nada.
    const changed = await auth.subscriptions.changeModules(billing.context, { modules: ["contratos"] }, request);
    if (!changed.ok) throw new Error(`troca falhou: ${changed.reason}`);

    await expect(auth.authorize(token, "expirations.read")).resolves.toEqual({
      ok: false,
      reason: "module_not_enabled",
    });
  });
});
