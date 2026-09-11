import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CORE_MODULE_KEY, MODULE_CATALOG } from "@/domain/billing/module-catalog";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseEntitlementService } from "@/infrastructure/access/database-entitlements";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTenantFixture, createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00.000Z");
const PASSWORD = "uma frase longa e secreta";
const request = { ipAddress: "203.0.113.40", userAgent: "vitest" };

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

  it("a limpeza entre testes não apaga o catálogo nem os preços", async () => {
    await truncateAllTables(prisma);
    expect(await prisma.module.count()).toBe(MODULE_CATALOG.length);
    // Um preço por módulo: também detecta teste que insere preço e não limpa.
    expect(await prisma.modulePrice.count()).toBe(MODULE_CATALOG.length);
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

const trialEndingIn = (days: number) => ({ status: "TRIALING" as const, trialEndsAt: new Date(now.getTime() + days * DAY) });

describe("entitlement por empresa com PostgreSQL", () => {
  const entitlements = () => createDatabaseEntitlementService(prisma, () => now);

  it("empresa sem assinatura (antes do Builder) usa o Core, mas não módulos pagos", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }] });

    await expect(entitlements().checkModule(companyId, CORE_MODULE_KEY)).resolves.toBe("enabled");
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("module_not_enabled");
  });

  it("trial vigente com módulo contratado: tudo liberado", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: trialEndingIn(10) });

    await expect(entitlements().checkModule(companyId, CORE_MODULE_KEY)).resolves.toBe("enabled");
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("enabled");
  });

  it("trial terminando (últimos dias) ainda libera", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: trialEndingIn(2) });
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("enabled");
  });

  it("trial vencido bloqueia TUDO, Core incluído", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: trialEndingIn(-1) });

    await expect(entitlements().checkModule(companyId, CORE_MODULE_KEY)).resolves.toBe("subscription_inactive");
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("subscription_inactive");
  });

  it.each(["PAST_DUE", "CANCELED", "SUSPENDED"] as const)(
    "assinatura %s bloqueia tudo, sem carência",
    async (status) => {
      const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status } });

      await expect(entitlements().checkModule(companyId, CORE_MODULE_KEY)).resolves.toBe("subscription_inactive");
      await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("subscription_inactive");
    },
  );

  it("pagamento em processamento não bloqueia", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status: "PAYMENT_PENDING" } });
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("enabled");
  });

  it("módulo não contratado fica bloqueado mesmo com assinatura ativa", async () => {
    const companyId = await companyWith({ modules: [{ key: "vencimentos" }], subscription: { status: "ACTIVE" } });
    await expect(entitlements().checkModule(companyId, "contratos")).resolves.toBe("module_not_enabled");
  });

  it("módulo desativado fica bloqueado", async () => {
    const companyId = await companyWith({
      modules: [{ key: "vencimentos", status: "INACTIVE" }],
      subscription: { status: "ACTIVE" },
    });
    await expect(entitlements().checkModule(companyId, "vencimentos")).resolves.toBe("module_not_enabled");
  });

  it("o bloqueio de uma empresa não afeta outra", async () => {
    const blocked = await companyWith({ subscription: trialEndingIn(-1) });
    const active = await companyWith({ subscription: { status: "ACTIVE" } });

    await expect(entitlements().checkModule(blocked, CORE_MODULE_KEY)).resolves.toBe("subscription_inactive");
    await expect(entitlements().checkModule(active, CORE_MODULE_KEY)).resolves.toBe("enabled");
  });

  it("o banco recusa módulo fora do catálogo", async () => {
    const { company } = await createTenantFixture(prisma, "entfk");
    await expect(
      prisma.companyModule.create({ data: { companyId: company.id, moduleKey: "modulo-inventado" } }),
    ).rejects.toThrow();
  });
});

describe("bloqueio total pela cadeia de autorização", () => {
  it("trial vencido bloqueia a empresa, preserva os dados e libera de novo ao assinar", async () => {
    const auth = createTestAuthServices(prisma, () => now);
    const owner = await auth.register(
      { name: "Dona", email: `dona-${randomUUID().slice(0, 8)}@example.com`, password: PASSWORD, companyName: "Empresa Trial" },
      request,
    );
    if (!owner.ok) throw new Error(`cadastro falhou: ${owner.reason}`);
    const companyId = owner.companyId;

    // GESTOR não exige segundo fator, o que isola o teste do MFA.
    const email = `gestor-${randomUUID().slice(0, 8)}@example.com`;
    const user = await prisma.user.create({
      data: { email, name: "Gestor", passwordHash: await createArgon2PasswordHasher().hash(PASSWORD) },
    });
    await prisma.membership.create({ data: { companyId, userId: user.id, status: "ACTIVE" } });
    const role = await prisma.role.findUniqueOrThrow({ where: { companyId_key: { companyId, key: "GESTOR" } } });
    await prisma.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
    const login = await auth.login({ identifier: email, password: PASSWORD }, request);
    if (!login.ok) throw new Error("login do gestor falhou");
    const token = login.session.token;

    const branch = await prisma.branch.create({ data: { companyId, name: "Matriz", code: "MTZ" } });

    // Antes do Builder: sem assinatura, o Core funciona.
    expect((await auth.authorize(token, "company.read")).ok).toBe(true);

    await prisma.subscription.create({
      data: { companyId, status: "TRIALING", trialStartedAt: new Date(now.getTime() - 15 * DAY), trialEndsAt: new Date(now.getTime() - DAY) },
    });
    await expect(auth.authorize(token, "company.read")).resolves.toEqual({
      ok: false,
      reason: "subscription_inactive",
    });

    // Nada foi apagado.
    expect(await prisma.company.findUnique({ where: { id: companyId } })).not.toBeNull();
    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).not.toBeNull();
    expect(await prisma.membership.count({ where: { companyId } })).toBe(2);

    // Ao assinar, volta tudo como estava.
    await prisma.subscription.update({ where: { companyId }, data: { status: "ACTIVE" } });
    expect((await auth.authorize(token, "company.read")).ok).toBe(true);
  });
});

describe("cadastro provisiona o Core", () => {
  it("empresa nova nasce com o Core ativo e sem assinatura (o trial começa no Builder)", async () => {
    const auth = createTestAuthServices(prisma);
    const result = await auth.register(
      { name: "Dona", email: "core-no-cadastro@example.com", password: PASSWORD, companyName: "Empresa Core" },
      request,
    );
    if (!result.ok) throw new Error(`cadastro falhou: ${result.reason}`);

    const modules = await prisma.companyModule.findMany({ where: { companyId: result.companyId } });
    expect(modules.map(({ moduleKey, status }) => ({ moduleKey, status }))).toEqual([
      { moduleKey: CORE_MODULE_KEY, status: "ACTIVE" },
    ]);
    expect(await prisma.subscription.findUnique({ where: { companyId: result.companyId } })).toBeNull();
  });
});
