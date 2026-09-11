import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { LastOwnerError } from "@/application/ports/member-management";
import type { SystemRoleKey } from "@/domain/access-control/system-roles";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createPrismaMemberManagementRepository } from "@/infrastructure/database/prisma-member-management-repository";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createTokenService } from "@/infrastructure/security/token-service";
import { createTestAuthServices, createTestPrismaClient, truncateAllTables } from "../support/database";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00.000Z");
const PASSWORD = "uma frase longa e secreta";
const request = { ipAddress: "203.0.113.60", userAgent: "vitest" };
const hasher = createArgon2PasswordHasher();

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

const contextOf = (companyId: string, userId: string, roleKeys: string[]): AuthorizedContext => ({
  companyId,
  userId,
  roleKeys,
  permissions: [],
});

async function registerOwner(companyName = "Empresa Convites") {
  const email = `dona-${randomUUID().slice(0, 8)}@example.com`;
  const result = await auth.register({ name: "Dona da Empresa", email, password: PASSWORD, companyName }, request);
  if (!result.ok) throw new Error(`cadastro falhou: ${result.reason}`);
  return {
    email,
    userId: result.userId,
    companyId: result.companyId,
    token: result.session.token,
    context: contextOf(result.companyId, result.userId, ["OWNER"]),
  };
}

async function addMember(companyId: string, roleKey: SystemRoleKey) {
  const email = `membro-${randomUUID().slice(0, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: `Membro ${roleKey}`, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.membership.create({ data: { companyId, userId: user.id, status: "ACTIVE" } });
  const role = await prisma.role.findUniqueOrThrow({ where: { companyId_key: { companyId, key: roleKey } } });
  await prisma.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
  return { userId: user.id, email, context: contextOf(companyId, user.id, [roleKey]) };
}

async function login(email: string) {
  const result = await auth.login({ identifier: email, password: PASSWORD }, request);
  if (!result.ok) throw new Error("login falhou");
  return result.session.token;
}

async function invite(context: AuthorizedContext, email: string, roleKey: string) {
  const result = await auth.members.invite(context, { email, roleKey }, request);
  if (!result.ok) throw new Error(`convite falhou: ${result.reason}`);
  return result;
}

describe("convites", () => {
  it("OWNER convida e a pessoa sem conta entra pelo link com o perfil do convite", async () => {
    const owner = await registerOwner();
    const invited = await invite(owner.context, "Nova.Pessoa@Example.com", "GESTOR");
    const expiresAt = new Date(now.getTime() + 7 * DAY);

    expect(invited.invitation).toMatchObject({
      email: "nova.pessoa@example.com",
      roleKey: "GESTOR",
      roleName: "Gestor",
      invitedByName: "Dona da Empresa",
      expiresAt,
    });

    const stored = await prisma.companyInvitation.findUniqueOrThrow({ where: { id: invited.invitation.id } });
    expect(stored.tokenHash).toBe(createTokenService().hash(invited.token));
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "member.invited" } });
    expect(JSON.stringify(log.metadata)).not.toContain("nova.pessoa");

    await expect(auth.members.previewInvitation(invited.token)).resolves.toEqual({
      companyName: "Empresa Convites",
      email: "no***@example.com",
      roleName: "Gestor",
      expiresAt,
    });

    const joined = await auth.members.signupWithInvitation(invited.token, { name: "Nova Pessoa", password: PASSWORD }, request);
    if (!joined.ok) throw new Error(`cadastro pelo convite falhou: ${joined.reason}`);

    expect(joined.companyId).toBe(owner.companyId);
    expect(await auth.company.findMember(owner.context, joined.userId)).toMatchObject({
      email: "nova.pessoa@example.com",
      status: "ACTIVE",
      roleKeys: ["GESTOR"],
    });
    expect(await prisma.company.count()).toBe(1);
    expect((await auth.authorize(joined.session.token, "company.read")).ok).toBe(true);

    await expect(auth.members.previewInvitation(invited.token)).resolves.toBeNull();
    await expect(
      auth.members.signupWithInvitation(invited.token, { name: "Outra Pessoa", password: PASSWORD }, request),
    ).resolves.toMatchObject({ ok: false, reason: "invitation_not_available" });
  });

  it("quem já tem conta aceita com a própria sessão; sem sessão ou com outro e-mail, não", async () => {
    const owner = await registerOwner("Empresa A");
    const guest = await registerOwner("Empresa B");
    const stranger = await registerOwner("Empresa C");
    const invited = await invite(owner.context, guest.email, "COLABORADOR");

    await expect(auth.members.acceptInvitation(invited.token, undefined, request)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    await expect(auth.members.acceptInvitation(invited.token, stranger.token, request)).resolves.toEqual({
      ok: false,
      reason: "email_mismatch",
    });
    await expect(auth.members.acceptInvitation(invited.token, guest.token, request)).resolves.toEqual({
      ok: true,
      companyId: owner.companyId,
    });

    const session = await auth.getCurrentSession(guest.token);
    expect(session?.session.activeCompanyId).toBe(owner.companyId);
    expect(session?.memberships.map((membership) => membership.companyId).sort()).toEqual(
      [owner.companyId, guest.companyId].sort(),
    );
  });

  it("um convite novo para o mesmo e-mail revoga o anterior; revogado ou vencido não vale", async () => {
    const owner = await registerOwner();
    const first = await invite(owner.context, "repetido@example.com", "GESTOR");
    const second = await invite(owner.context, "repetido@example.com", "COLABORADOR");

    await expect(auth.members.previewInvitation(first.token)).resolves.toBeNull();
    await expect(auth.members.previewInvitation(second.token)).resolves.not.toBeNull();
    expect((await auth.members.listInvitations(owner.context)).map((invitation) => invitation.id)).toEqual([
      second.invitation.id,
    ]);

    const eightDaysLater = createTestAuthServices(prisma, () => new Date(now.getTime() + 8 * DAY));
    await expect(eightDaysLater.members.previewInvitation(second.token)).resolves.toBeNull();

    await expect(auth.members.revokeInvitation(owner.context, second.invitation.id, request)).resolves.toEqual({ ok: true });
    await expect(auth.members.previewInvitation(second.token)).resolves.toBeNull();
    await expect(auth.members.revokeInvitation(owner.context, second.invitation.id, request)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(auth.members.previewInvitation("token-malformado")).resolves.toBeNull();
  });

  it("não convida quem já é membro, nem concede Proprietário sem ser Proprietário, nem perfil inexistente", async () => {
    const owner = await registerOwner();
    const admin = await addMember(owner.companyId, "ADMIN");

    await expect(auth.members.invite(admin.context, { email: "novo@example.com", roleKey: "OWNER" }, request)).resolves.toEqual({
      ok: false,
      reason: "role_not_allowed",
    });
    await expect(auth.members.invite(owner.context, { email: admin.email, roleKey: "GESTOR" }, request)).resolves.toEqual({
      ok: false,
      reason: "already_member",
    });
    await expect(
      auth.members.invite(owner.context, { email: "novo@example.com", roleKey: "INEXISTENTE" }, request),
    ).resolves.toMatchObject({ ok: false, reason: "invalid_input" });
    expect(await prisma.companyInvitation.count()).toBe(0);
  });
});

describe("gestão de membros", () => {
  it("troca de perfil, suspensão e reativação respeitam as proteções", async () => {
    const owner = await registerOwner();
    const gestor = await addMember(owner.companyId, "GESTOR");
    const admin = await addMember(owner.companyId, "ADMIN");
    const otherOwner = await addMember(owner.companyId, "OWNER");

    await expect(
      auth.members.changeRoles(owner.context, gestor.userId, { roleKeys: ["COLABORADOR", "COLABORADOR"] }, request),
    ).resolves.toEqual({ ok: true });
    expect((await auth.company.findMember(owner.context, gestor.userId))?.roleKeys).toEqual(["COLABORADOR"]);

    await expect(auth.members.changeRoles(owner.context, owner.userId, { roleKeys: ["ADMIN"] }, request)).resolves.toEqual({
      ok: false,
      reason: "cannot_modify_self",
    });
    await expect(auth.members.changeRoles(admin.context, otherOwner.userId, { roleKeys: ["GESTOR"] }, request)).resolves.toEqual({
      ok: false,
      reason: "role_not_allowed",
    });
    await expect(auth.members.changeRoles(admin.context, gestor.userId, { roleKeys: ["OWNER"] }, request)).resolves.toEqual({
      ok: false,
      reason: "role_not_allowed",
    });
    await expect(auth.members.changeRoles(owner.context, randomUUID(), { roleKeys: ["GESTOR"] }, request)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });

    const gestorToken = await login(gestor.email);
    await expect(auth.members.setStatus(owner.context, gestor.userId, { status: "SUSPENDED" }, request)).resolves.toEqual({
      ok: true,
    });
    await expect(auth.authorize(gestorToken, "company.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(auth.members.setStatus(owner.context, gestor.userId, { status: "ACTIVE" }, request)).resolves.toEqual({
      ok: true,
    });
    expect((await auth.authorize(gestorToken, "company.read")).ok).toBe(true);

    expect(
      await prisma.auditLog.count({
        where: { action: { in: ["member.roles_changed", "member.suspended", "member.reactivated"] } },
      }),
    ).toBe(3);
  });

  it("remover: some da listagem, perde o acesso, preserva o histórico e pode ser convidado de novo", async () => {
    const owner = await registerOwner();
    const member = await addMember(owner.companyId, "COLABORADOR");
    const memberToken = await login(member.email);
    await prisma.auditLog.create({
      data: { companyId: owner.companyId, actorUserId: member.userId, action: "teste.historico" },
    });

    await expect(auth.members.remove(owner.context, member.userId, request)).resolves.toEqual({ ok: true });

    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { companyId_userId: { companyId: owner.companyId, userId: member.userId } },
      }),
    ).toMatchObject({ status: "REMOVED" });
    expect(await prisma.userRole.count({ where: { companyId: owner.companyId, userId: member.userId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorUserId: member.userId, action: "teste.historico" } })).toBe(1);
    expect((await auth.company.listMembers(owner.context)).map((entry) => entry.userId)).not.toContain(member.userId);
    await expect(auth.company.findMember(owner.context, member.userId)).resolves.toBeNull();
    await expect(auth.authorize(memberToken, "company.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
    expect((await auth.getCurrentSession(memberToken))?.memberships).toEqual([]);
    await expect(auth.members.remove(owner.context, member.userId, request)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });

    const again = await invite(owner.context, member.email, "GESTOR");
    await expect(auth.members.acceptInvitation(again.token, memberToken, request)).resolves.toEqual({
      ok: true,
      companyId: owner.companyId,
    });
    expect(await auth.company.findMember(owner.context, member.userId)).toMatchObject({
      status: "ACTIVE",
      roleKeys: ["GESTOR"],
    });
  });

  it("o banco nunca deixa a empresa sem Proprietário ativo", async () => {
    const owner = await registerOwner();
    const repository = createPrismaMemberManagementRepository(prisma);
    const admin = await prisma.role.findUniqueOrThrow({
      where: { companyId_key: { companyId: owner.companyId, key: "ADMIN" } },
    });

    await expect(repository.replaceMemberRoles(owner.companyId, owner.userId, [admin.id])).rejects.toBeInstanceOf(
      LastOwnerError,
    );
    await expect(repository.setMemberStatus(owner.companyId, owner.userId, "SUSPENDED")).rejects.toBeInstanceOf(
      LastOwnerError,
    );
    await expect(repository.setMemberStatus(owner.companyId, owner.userId, "REMOVED")).rejects.toBeInstanceOf(
      LastOwnerError,
    );

    expect(await auth.company.findMember(owner.context, owner.userId)).toMatchObject({
      status: "ACTIVE",
      roleKeys: ["OWNER"],
    });
  });

  it("perfis listados na ordem do sistema, com permissões e membros ativos", async () => {
    const owner = await registerOwner();
    await addMember(owner.companyId, "GESTOR");

    const roles = await auth.members.listRoles(owner.context);
    expect(roles.map((role) => role.key)).toEqual(["OWNER", "ADMIN", "GESTOR", "COLABORADOR", "VISUALIZADOR"]);
    expect(roles.find((role) => role.key === "GESTOR")?.memberCount).toBe(1);
    expect(roles.find((role) => role.key === "OWNER")?.permissions).toContain("members.manage");
  });
});
