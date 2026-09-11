import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00.000Z");
const PASSWORD = "uma frase longa e secreta";
const request = { ipAddress: "203.0.113.50", userAgent: "vitest" };
const BILLING_PERMISSIONS = ["billing.read", "billing.manage"];

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

async function registerCompany() {
  const owner = await auth.register(
    {
      name: "Dona",
      email: `dona-${randomUUID().slice(0, 8)}@example.com`,
      password: PASSWORD,
      companyName: "Empresa Builder",
    },
    request,
  );
  if (!owner.ok) throw new Error(`cadastro falhou: ${owner.reason}`);
  return owner.companyId;
}

/** GESTOR com as permissões de assinatura: não exige segundo fator, o que isola o teste do MFA. */
async function managerWithBilling(companyId: string) {
  const email = `gestor-${randomUUID().slice(0, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: "Gestor", passwordHash: await createArgon2PasswordHasher().hash(PASSWORD) },
  });
  await prisma.membership.create({ data: { companyId, userId: user.id, status: "ACTIVE" } });
  const role = await prisma.role.findUniqueOrThrow({ where: { companyId_key: { companyId, key: "GESTOR" } } });
  await prisma.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
  const permissions = await prisma.permission.findMany({ where: { key: { in: BILLING_PERMISSIONS } } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });

  const login = await auth.login({ identifier: email, password: PASSWORD }, request);
  if (!login.ok) throw new Error("login do gestor falhou");
  return login.session.token;
}

async function authorized(token: string, permission: "billing.read" | "billing.manage") {
  const result = await auth.authorize(token, permission);
  if (!result.ok) throw new Error(`esperava autorização: ${result.reason}`);
  return result.context;
}

describe("permissões de assinatura", () => {
  it("só OWNER e ADMIN recebem as permissões de assinatura no cadastro", async () => {
    const companyId = await registerCompany();
    const roles = await prisma.role.findMany({
      where: { companyId },
      select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
    });

    const billingByRole = Object.fromEntries(
      roles.map((role) => [
        role.key,
        role.permissions
          .map((grant) => grant.permission.key)
          .filter((key) => key.startsWith("billing."))
          .sort(),
      ]),
    );
    expect(billingByRole).toEqual({
      OWNER: ["billing.manage", "billing.read"],
      ADMIN: ["billing.manage", "billing.read"],
      GESTOR: [],
      COLABORADOR: [],
      VISUALIZADOR: [],
    });
  });
});

describe("início do trial pelo Builder", () => {
  it("kit Gestão + Contratos: 14 dias, módulos ativados, auditoria e R$ 169,80 por mês depois do trial", async () => {
    const companyId = await registerCompany();
    const context = await authorized(await managerWithBilling(companyId), "billing.manage");

    await expect(auth.subscriptions.getSummary(context)).resolves.toMatchObject({
      status: "NOT_STARTED",
      hasAccess: true,
      monthlyTotalCents: null,
    });

    const result = await auth.subscriptions.startTrial(context, { kitKey: "gestao", modules: ["contratos"] }, request);
    if (!result.ok) throw new Error(`esperava trial: ${result.reason}`);

    expect(result.subscription).toMatchObject({
      status: "TRIAL_ACTIVE",
      hasAccess: true,
      trial: { startedAt: now, endsAt: new Date(now.getTime() + 14 * DAY), daysRemaining: 14 },
      kit: { key: "gestao", name: "Gestão" },
      monthlyTotalCents: 16980,
      currency: "BRL",
      dataRetentionUntil: null,
    });
    expect(result.subscription.modules.map((entry) => entry.key)).toEqual([
      "core",
      "vencimentos",
      "funcionarios",
      "fornecedores",
      "contratos",
      "solicitacoes",
    ]);

    expect(await prisma.subscription.findUniqueOrThrow({ where: { companyId } })).toMatchObject({
      status: "TRIALING",
      kitKey: "gestao",
    });
    expect(await prisma.companyModule.count({ where: { companyId, status: "ACTIVE" } })).toBe(6);
    expect(await prisma.auditLog.count({ where: { companyId, action: "subscription.trial_started" } })).toBe(1);

    await expect(auth.subscriptions.startTrial(context, { modules: [] }, request)).resolves.toEqual({
      ok: false,
      reason: "trial_already_started",
    });
  });

  it("escolha inválida não cria assinatura nem ativa módulos", async () => {
    const companyId = await registerCompany();
    const context = await authorized(await managerWithBilling(companyId), "billing.manage");

    const result = await auth.subscriptions.startTrial(
      context,
      { kitKey: "kit-inventado", modules: ["modulo-inventado"] },
      request,
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.companyModule.count({ where: { companyId } })).toBe(1);
  });
});

describe("empresa bloqueada continua vendo a assinatura", () => {
  it("com o trial vencido o Core é recusado, mas a situação da assinatura segue acessível", async () => {
    const companyId = await registerCompany();
    const token = await managerWithBilling(companyId);
    const started = await auth.subscriptions.startTrial(
      await authorized(token, "billing.manage"),
      { modules: ["vencimentos"] },
      request,
    );
    if (!started.ok) throw new Error(`esperava trial: ${started.reason}`);

    await prisma.subscription.update({ where: { companyId }, data: { trialEndsAt: new Date(now.getTime() - DAY) } });

    await expect(auth.authorize(token, "company.read")).resolves.toEqual({
      ok: false,
      reason: "subscription_inactive",
    });
    await expect(auth.subscriptions.getSummary(await authorized(token, "billing.read"))).resolves.toMatchObject({
      status: "TRIAL_EXPIRED",
      hasAccess: false,
      trial: { daysRemaining: 0 },
      monthlyTotalCents: 6980,
    });
  });
});
