import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseEntitlementService } from "@/infrastructure/access/database-entitlements";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00.000Z");
const PASSWORD = "uma frase longa e secreta";
const request = { ipAddress: "203.0.113.70", userAgent: "vitest" };

let prisma: PrismaClient;
let auth: AuthServices;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  auth = createTestAuthServices(prisma, () => now);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Empresa com um GESTOR que tem as permissões de assinatura (sem MFA, para isolar o teste). */
async function companyWithManager() {
  const owner = await auth.register(
    { name: "Dona", email: `dona-${randomUUID().slice(0, 8)}@example.com`, password: PASSWORD, companyName: "Empresa Troca" },
    request,
  );
  if (!owner.ok) throw new Error(`cadastro falhou: ${owner.reason}`);
  const companyId = owner.companyId;

  const email = `gestor-${randomUUID().slice(0, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: "Gestor", passwordHash: await createArgon2PasswordHasher().hash(PASSWORD) },
  });
  await prisma.membership.create({ data: { companyId, userId: user.id, status: "ACTIVE" } });
  const role = await prisma.role.findUniqueOrThrow({ where: { companyId_key: { companyId, key: "GESTOR" } } });
  await prisma.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
  const permissions = await prisma.permission.findMany({ where: { key: { in: ["billing.read", "billing.manage"] } } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });

  const login = await auth.login({ identifier: email, password: PASSWORD }, request);
  if (!login.ok) throw new Error("login falhou");
  const authorization = await auth.authorize(login.session.token, "billing.manage");
  if (!authorization.ok) throw new Error(`autorização falhou: ${authorization.reason}`);
  return { companyId, context: authorization.context };
}

const activeKeys = async (companyId: string) =>
  (await prisma.companyModule.findMany({ where: { companyId, status: "ACTIVE" }, select: { moduleKey: true } }))
    .map((row) => row.moduleKey)
    .sort();

describe("troca de módulos durante o trial com PostgreSQL", () => {
  it("troca o kit, ativa e desativa módulos sem apagar dados e mantém as datas do trial", async () => {
    const { companyId, context } = await companyWithManager();
    const started = await auth.subscriptions.startTrial(context, { kitKey: "gestao", modules: ["contratos"] }, request);
    if (!started.ok) throw new Error(`trial falhou: ${started.reason}`);

    const changed = await auth.subscriptions.changeModules(
      context,
      { kitKey: "comunicacao", modules: ["vencimentos"] },
      request,
    );
    if (!changed.ok) throw new Error(`troca falhou: ${changed.reason}`);

    expect(changed.subscription).toMatchObject({
      status: "TRIAL_ACTIVE",
      canChangeModules: true,
      kit: { key: "comunicacao", name: "Comunicação" },
      monthlyTotalCents: 13980,
      trial: { endsAt: new Date(now.getTime() + 14 * DAY), daysRemaining: 14 },
    });
    expect(changed.subscription.modules.map((entry) => entry.key)).toEqual([
      "core",
      "vencimentos",
      "solicitacoes",
      "whatsapp",
      "portal-terceiros",
    ]);

    // Nada apagado: os que saíram continuam na tabela, inativos e com data.
    const left = await prisma.companyModule.findMany({
      where: { companyId, moduleKey: { in: ["funcionarios", "fornecedores", "contratos"] } },
    });
    expect(left).toHaveLength(3);
    expect(left.every((row) => row.status === "INACTIVE" && row.deactivatedAt?.getTime() === now.getTime())).toBe(true);
    expect(await prisma.companyModule.count({ where: { companyId } })).toBe(8);

    expect(await prisma.subscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({
      status: "TRIALING",
      kitKey: "comunicacao",
      trialEndsAt: new Date(now.getTime() + 14 * DAY),
    });

    const log = await prisma.auditLog.findFirstOrThrow({ where: { companyId, action: "subscription.modules_changed" } });
    expect(log.metadata).toEqual({
      kitKey: "comunicacao",
      previousKitKey: "gestao",
      activated: "portal-terceiros,whatsapp",
      deactivated: "contratos,fornecedores,funcionarios",
      monthlyTotalCents: 13980,
    });

    const entitlements = createDatabaseEntitlementService(prisma, () => now);
    await expect(entitlements.checkModule(companyId, "contratos")).resolves.toBe("module_not_enabled");
    await expect(entitlements.checkModule(companyId, "whatsapp")).resolves.toBe("enabled");
  });

  it("voltar a escolher um módulo desativado reaproveita a mesma linha", async () => {
    const { companyId, context } = await companyWithManager();
    await auth.subscriptions.startTrial(context, { modules: ["contratos"] }, request);
    await auth.subscriptions.changeModules(context, { modules: [] }, request);
    const before = await prisma.companyModule.findUniqueOrThrow({
      where: { companyId_moduleKey: { companyId, moduleKey: "contratos" } },
    });
    expect(before.status).toBe("INACTIVE");

    const back = await auth.subscriptions.changeModules(context, { modules: ["contratos"] }, request);

    expect(back).toMatchObject({ ok: true, subscription: { monthlyTotalCents: 8980 } });
    const after = await prisma.companyModule.findUniqueOrThrow({
      where: { companyId_moduleKey: { companyId, moduleKey: "contratos" } },
    });
    expect(after).toMatchObject({ status: "ACTIVE", deactivatedAt: null });
    expect(after.createdAt).toEqual(before.createdAt);
  });

  it("fora do teste grátis vigente não troca nada", async () => {
    const { companyId, context } = await companyWithManager();

    await expect(auth.subscriptions.changeModules(context, { modules: ["vencimentos"] }, request)).resolves.toEqual({
      ok: false,
      reason: "trial_not_started",
    });

    await auth.subscriptions.startTrial(context, { modules: ["contratos"] }, request);
    await prisma.subscription.update({ where: { companyId }, data: { trialEndsAt: new Date(now.getTime() - DAY) } });

    await expect(auth.subscriptions.changeModules(context, { modules: ["vencimentos"] }, request)).resolves.toEqual({
      ok: false,
      reason: "not_in_trial",
    });
    expect(await activeKeys(companyId)).toEqual(["contratos", "core"]);
  });

  it("escolha inválida não altera nada", async () => {
    const { companyId, context } = await companyWithManager();
    await auth.subscriptions.startTrial(context, { kitKey: "gestao" }, request);
    const before = await activeKeys(companyId);

    await expect(
      auth.subscriptions.changeModules(context, { kitKey: "kit-inventado", modules: ["modulo-inventado"] }, request),
    ).resolves.toMatchObject({ ok: false, reason: "invalid_input" });

    expect(await activeKeys(companyId)).toEqual(before);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { companyId } })).kitKey).toBe("gestao");
  });

  it("o repositório confere o trial de novo no momento da gravação", async () => {
    const { companyId, context } = await companyWithManager();
    await auth.subscriptions.startTrial(context, { modules: ["contratos"] }, request);
    await prisma.subscription.update({ where: { companyId }, data: { status: "ACTIVE" } });

    const { createPrismaSubscriptionRepository } = await import(
      "@/infrastructure/database/prisma-subscription-repository"
    );
    await expect(
      createPrismaSubscriptionRepository(prisma).changeModules({ companyId, kitKey: null, modules: ["core"], at: now }),
    ).rejects.toThrow("teste grátis vigente");
    expect(await activeKeys(companyId)).toEqual(["contratos", "core"]);
  });
});
