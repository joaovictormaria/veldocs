import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CORE_MODULE_KEY, MODULE_CATALOG } from "@/domain/billing/module-catalog";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseEntitlementService } from "@/infrastructure/access/database-entitlements";
import { createTenantFixture, createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00.000Z");

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  // Preserva o catálogo global povoado pela migração (ver truncateAllTables).
  await truncateAllTables(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("catálogo de módulos no banco", () => {
  it("as linhas da migração correspondem exatamente ao catálogo do domínio", async () => {
    const rows = await prisma.module.findMany({ orderBy: { sortOrder: "asc" } });

    expect(
      rows.map(({ key, name, description, benefit, isCore }) => ({ key, name, description, benefit, isCore })),
    ).toEqual(
      MODULE_CATALOG.map(({ key, name, description, benefit, isCore }) => ({ key, name, description, benefit, isCore })),
    );
  });

  it("a limpeza entre testes não apaga o catálogo", async () => {
    await truncateAllTables(prisma);
    expect(await prisma.module.count()).toBe(MODULE_CATALOG.length);
  });
});

type SubscriptionFixture = {
  status: "TRIALING" | "ACTIVE" | "PAYMENT_PENDING" | "PAST_DUE" | "CANCELED" | "SUSPENDED";
  trialEndsAt?: Date | null;
};

async function companyWith(options: {
  modules?: Array<{ key: string; status?: "ACTIVE" | "INACTIVE" }>;
  subscription?: SubscriptionFixture;
}) {
  const { company } = await createTenantFixture(prisma, `ent${Math.random().toString(36).slice(2, 7)}`);
  for (const contracted of options.modules ?? []) {
    await prisma.companyModule.create({
      data: { companyId: company.id, moduleKey: contracted.key, status: contracted.status ?? "ACTIVE" },
    });
  }
  if (options.subscription) {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        status: options.subscription.status,
        trialEndsAt: options.subscription.trialEndsAt ?? null,
      },
    });
  }
  return company.id;
}

describe("entitlement por empresa com PostgreSQL", () => {
  const entitlements = () => createDatabaseEntitlementService(prisma, () => now);

  it("o Core vale sempre, mesmo sem assinatura e sem linha de módulo", async () => {
    const companyId = await companyWith({});
    await expect(entitlements().isModuleEnabled(companyId, CORE_MODULE_KEY)).resolves.toBe(true);
  });

  it("módulo pago contratado e trial vigente: liberado", async () => {
    const companyId = await companyWith({
      modules: [{ key: "vencimentos" }],
      subscription: { status: "TRIALING", trialEndsAt: new Date(now.getTime() + 10 * DAY) },
    });
    await expect(entitlements().isModuleEnabled(companyId, "vencimentos")).resolves.toBe(true);
  });

  it("trial vencido bloqueia o módulo pago, mas não o Core", async () => {
    const companyId = await companyWith({
      modules: [{ key: CORE_MODULE_KEY }, { key: "vencimentos" }],
      subscription: { status: "TRIALING", trialEndsAt: new Date(now.getTime() - DAY) },
    });

    await expect(entitlements().isModuleEnabled(companyId, "vencimentos")).resolves.toBe(false);
    await expect(entitlements().isModuleEnabled(companyId, CORE_MODULE_KEY)).resolves.toBe(true);
  });

  it("módulo não contratado fica bloqueado mesmo com assinatura ativa", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status: "ACTIVE" } });
    await expect(entitlements().isModuleEnabled(companyId, "contratos")).resolves.toBe(false);
  });

  it("módulo desativado fica bloqueado", async () => {
    const companyId = await companyWith({
      modules: [{ key: "vencimentos", status: "INACTIVE" }],
      subscription: { status: "ACTIVE" },
    });
    await expect(entitlements().isModuleEnabled(companyId, "vencimentos")).resolves.toBe(false);
  });

  it("módulo contratado sem assinatura não é utilizável", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }] });
    await expect(entitlements().isModuleEnabled(companyId, "vencimentos")).resolves.toBe(false);
  });

  it.each(["PAST_DUE", "CANCELED", "SUSPENDED"] as const)("assinatura %s bloqueia módulos pagos", async (status) => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status } });
    await expect(entitlements().isModuleEnabled(companyId, "vencimentos")).resolves.toBe(false);
  });

  it("o entitlement de uma empresa não vale para outra", async () => {
    const withModule = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status: "ACTIVE" } });
    const without = await companyWith({ subscription: { status: "ACTIVE" } });

    await expect(entitlements().isModuleEnabled(withModule, "vencimentos")).resolves.toBe(true);
    await expect(entitlements().isModuleEnabled(without, "vencimentos")).resolves.toBe(false);
  });

  it("o banco recusa módulo fora do catálogo", async () => {
    const { company } = await createTenantFixture(prisma, "entfk");
    await expect(
      prisma.companyModule.create({ data: { companyId: company.id, moduleKey: "modulo-inventado" } }),
    ).rejects.toThrow();
  });
});

describe("cadastro provisiona o Core", () => {
  it("empresa nova nasce com o Core ativo e sem assinatura (o trial começa no Builder)", async () => {
    const auth = createTestAuthServices(prisma);
    const result = await auth.register(
      {
        name: "Dona",
        email: "core-no-cadastro@example.com",
        password: "uma frase longa e secreta",
        companyName: "Empresa Core",
      },
      { ipAddress: "203.0.113.40", userAgent: "vitest" },
    );
    if (!result.ok) throw new Error(`cadastro falhou: ${result.reason}`);

    const modules = await prisma.companyModule.findMany({ where: { companyId: result.companyId } });
    expect(modules.map(({ moduleKey, status }) => ({ moduleKey, status }))).toEqual([
      { moduleKey: CORE_MODULE_KEY, status: "ACTIVE" },
    ]);
    expect(await prisma.subscription.findUnique({ where: { companyId: result.companyId } })).toBeNull();
  });
});
