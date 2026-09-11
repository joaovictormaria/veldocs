import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuthorizer } from "@/application/access/authorize";
import { createSessionManager } from "@/application/auth/session-manager";
import type { SystemRoleKey } from "@/domain/access-control/system-roles";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createPrismaAccessControlRepository } from "@/infrastructure/database/prisma-access-control-repository";
import { createPrismaIdentityRepository } from "@/infrastructure/database/prisma-identity-repository";
import { createPrismaMfaRepository } from "@/infrastructure/database/prisma-mfa-repository";
import { createPrismaSessionRepository } from "@/infrastructure/database/prisma-session-repository";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTokenService } from "@/infrastructure/security/token-service";
import { totpCode, totpStep } from "@/infrastructure/security/totp";
import {
  TEST_APPLICATION_KEYS,
  createTestAuthServices,
  createTestPrismaClient,
  truncateAllTables,
} from "../support/database";

const PASSWORD = "uma frase longa e secreta";
const context = { ipAddress: "203.0.113.20", userAgent: "vitest" };
const hasher = createArgon2PasswordHasher();

let prisma: PrismaClient;
let auth: AuthServices;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  auth = createTestAuthServices(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const uniqueEmail = () => `acesso-${randomUUID().slice(0, 8)}@example.com`;

async function registerOwner(companyName = "Empresa A") {
  const result = await auth.register(
    { name: "Dona da Empresa", email: uniqueEmail(), password: PASSWORD, companyName },
    context,
  );
  if (!result.ok) throw new Error(`cadastro falhou: ${JSON.stringify(result)}`);
  return result;
}

/** OWNER e ADMIN só acessam depois de cadastrar o segundo fator. */
async function enableMfa(token: string) {
  const start = await auth.mfa.start(token, context);
  if (!start.ok) throw new Error(`falha ao iniciar MFA: ${start.reason}`);
  const confirmation = await auth.mfa.confirm(token, { code: totpCode(start.secret, totpStep(new Date())) }, context);
  if (!confirmation.ok) throw new Error(`falha ao confirmar MFA: ${confirmation.reason}`);
  return confirmation.recoveryCodes;
}

/** Cria uma pessoa com vínculo ativo e os perfis indicados na empresa, e faz login. */
async function addMember(companyId: string, roleKeys: SystemRoleKey[]) {
  const email = uniqueEmail();
  const user = await prisma.user.create({
    data: { email, name: `Membro ${roleKeys.join("+")}`, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.membership.create({ data: { companyId, userId: user.id, status: "ACTIVE" } });
  for (const key of roleKeys) {
    const role = await prisma.role.findUniqueOrThrow({ where: { companyId_key: { companyId, key } } });
    await prisma.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
  }
  const login = await auth.login({ identifier: email, password: PASSWORD }, context);
  if (!login.ok) throw new Error("login do membro falhou");
  return { userId: user.id, token: login.session.token };
}

describe("cadeia de autorização com PostgreSQL", () => {
  it("OWNER acessa a própria empresa e lista seus membros após o segundo fator", async () => {
    const owner = await registerOwner();

    await expect(auth.authorize(owner.session.token, "members.read")).resolves.toEqual({
      ok: false,
      reason: "mfa_enrollment_required",
    });
    await enableMfa(owner.session.token);

    const authorization = await auth.authorize(owner.session.token, "members.read");
    if (!authorization.ok) throw new Error(`esperava autorização: ${authorization.reason}`);
    expect(authorization.context.companyId).toBe(owner.companyId);
    expect(authorization.context.roleKeys).toEqual(["OWNER"]);

    expect(await auth.company.currentCompany(authorization.context)).toMatchObject({
      id: owner.companyId,
      name: "Empresa A",
      status: "ACTIVE",
    });
    const members = await auth.company.listMembers(authorization.context);
    expect(members).toEqual([expect.objectContaining({ userId: owner.userId, status: "ACTIVE", roleKeys: ["OWNER"] })]);
    expect(Object.keys(members[0] ?? {}).sort()).toEqual(["email", "joinedAt", "name", "roleKeys", "status", "userId"]);
  });

  it("VISUALIZADOR lê a empresa, mas não lista membros, e não precisa de segundo fator", async () => {
    const owner = await registerOwner();
    const viewer = await addMember(owner.companyId, ["VISUALIZADOR"]);

    await expect(auth.authorize(viewer.token, "company.read")).resolves.toMatchObject({ ok: true });
    await expect(auth.authorize(viewer.token, "members.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("as permissões do vínculo são a união dos perfis atribuídos", async () => {
    const owner = await registerOwner();
    const member = await addMember(owner.companyId, ["VISUALIZADOR", "COLABORADOR"]);

    const access = await createPrismaAccessControlRepository(prisma).findMembershipAccess(member.userId, owner.companyId);

    expect(access?.roleKeys).toEqual(["COLABORADOR", "VISUALIZADOR"]);
    expect(access?.permissions).toEqual(expect.arrayContaining(["company.read", "documents.create", "documents.update"]));
    expect(access?.permissions).not.toContain("members.read");
  });

  it("vínculo suspenso ou empresa suspensa perdem o acesso imediatamente, mesmo com sessão válida", async () => {
    const owner = await registerOwner();
    await enableMfa(owner.session.token);
    const member = await addMember(owner.companyId, ["GESTOR"]);
    await expect(auth.authorize(member.token, "members.read")).resolves.toMatchObject({ ok: true });

    await prisma.membership.update({
      where: { companyId_userId: { companyId: owner.companyId, userId: member.userId } },
      data: { status: "SUSPENDED" },
    });
    await expect(auth.authorize(member.token, "company.read")).resolves.toEqual({ ok: false, reason: "forbidden" });

    await prisma.company.update({ where: { id: owner.companyId }, data: { status: "SUSPENDED" } });
    await expect(auth.authorize(owner.session.token, "company.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("pessoa em duas empresas escolhe a empresa ativa e só pode escolher empresas das quais é membro", async () => {
    const companyA = await registerOwner("Empresa A");
    const companyB = await registerOwner("Empresa B");
    const accountant = await addMember(companyA.companyId, ["GESTOR"]);
    await prisma.membership.create({ data: { companyId: companyB.companyId, userId: accountant.userId, status: "ACTIVE" } });
    const viewerRoleB = await prisma.role.findUniqueOrThrow({
      where: { companyId_key: { companyId: companyB.companyId, key: "VISUALIZADOR" } },
    });
    await prisma.userRole.create({ data: { companyId: companyB.companyId, userId: accountant.userId, roleId: viewerRoleB.id } });

    const [user] = await prisma.user.findMany({ where: { id: accountant.userId }, select: { email: true } });
    const login = await auth.login({ identifier: user?.email ?? "", password: PASSWORD }, context);
    if (!login.ok) throw new Error("login falhou");
    const token = login.session.token;

    await expect(auth.authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "active_company_required" });

    await expect(auth.selectActiveCompany(token, { companyId: companyB.companyId }, context)).resolves.toEqual({
      ok: true,
      activeCompanyId: companyB.companyId,
    });
    const inB = await auth.authorize(token, "company.read");
    expect(inB).toMatchObject({ ok: true, context: { companyId: companyB.companyId, roleKeys: ["VISUALIZADOR"] } });
    await expect(auth.authorize(token, "members.read")).resolves.toEqual({ ok: false, reason: "forbidden" });

    await expect(auth.selectActiveCompany(token, { companyId: companyA.companyId }, context)).resolves.toMatchObject({ ok: true });
    await expect(auth.authorize(token, "members.read")).resolves.toMatchObject({ ok: true, context: { companyId: companyA.companyId } });

    const outsider = await registerOwner("Empresa C");
    for (const companyId of [outsider.companyId, randomUUID()]) {
      await expect(auth.selectActiveCompany(token, { companyId }, context)).resolves.toEqual({
        ok: false,
        reason: "company_not_available",
      });
    }
    await expect(auth.authorize(token, "members.read")).resolves.toMatchObject({ ok: true, context: { companyId: companyA.companyId } });

    expect(
      await prisma.auditLog.count({ where: { action: "auth.active_company_selected", actorUserId: accountant.userId } }),
    ).toBe(2);
  });

  it("consultas nunca retornam dados de outra empresa (IDOR)", async () => {
    const companyA = await registerOwner("Empresa A");
    const companyB = await registerOwner("Empresa B");
    await enableMfa(companyA.session.token);

    const authorization = await auth.authorize(companyA.session.token, "members.read");
    if (!authorization.ok) throw new Error("esperava autorização");

    expect(await auth.company.findMember(authorization.context, companyB.userId)).toBeNull();
    expect(await auth.company.findMember(authorization.context, companyA.userId)).not.toBeNull();
    expect((await auth.company.listMembers(authorization.context)).map((member) => member.userId)).toEqual([
      companyA.userId,
    ]);
  });

  it("módulo não habilitado bloqueia mesmo com vínculo, segundo fator e permissão", async () => {
    const owner = await registerOwner();
    await enableMfa(owner.session.token);

    const authorize = createAuthorizer({
      sessions: createSessionManager({
        sessions: createPrismaSessionRepository(prisma),
        tokens: createTokenService(),
        now: () => new Date(),
      }),
      identity: createPrismaIdentityRepository(prisma),
      access: createPrismaAccessControlRepository(prisma),
      mfa: createPrismaMfaRepository(prisma, TEST_APPLICATION_KEYS),
      entitlements: { isModuleEnabled: async () => false },
    });

    await expect(authorize(owner.session.token, "company.read")).resolves.toEqual({
      ok: false,
      reason: "module_not_enabled",
    });
  });
});
