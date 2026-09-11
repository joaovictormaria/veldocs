import { AccountAlreadyExistsError } from "@/application/auth/shared";
import {
  AlreadyMemberError,
  InvitationNotAvailableError,
  LastOwnerError,
  type MemberManagementRepository,
} from "@/application/ports/member-management";
import { OWNER_ROLE_KEY } from "@/domain/access-control/member-rules";
import { SYSTEM_ROLE_KEYS, type SystemRoleKey } from "@/domain/access-control/system-roles";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;

const invitationSelect = {
  id: true,
  email: true,
  expiresAt: true,
  createdAt: true,
  role: { select: { key: true, name: true } },
  invitedBy: { select: { user: { select: { name: true } } } },
} as const;

type InvitationRow = Prisma.CompanyInvitationGetPayload<{ select: typeof invitationSelect }>;

const toInvitation = (row: InvitationRow) => ({
  id: row.id,
  email: row.email,
  roleKey: row.role.key,
  roleName: row.role.name,
  invitedByName: row.invitedBy.user.name,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
});

const systemRoleOrder = (key: string) => {
  const index = SYSTEM_ROLE_KEYS.indexOf(key as SystemRoleKey);
  return index === -1 ? SYSTEM_ROLE_KEYS.length : index;
};

/** Convite ainda utilizável em `at`. */
const pendingWhere = (at: Date) => ({ acceptedAt: null, revokedAt: null, expiresAt: { gt: at } });

/** Marca o convite como usado; falha se outra requisição usou antes. */
async function claimInvitation(
  tx: Prisma.TransactionClient,
  input: { invitationId: string; companyId: string; userId: string; at: Date },
) {
  const claimed = await tx.companyInvitation.updateMany({
    where: { id: input.invitationId, companyId: input.companyId, ...pendingWhere(input.at) },
    data: { acceptedAt: input.at, acceptedByUserId: input.userId },
  });
  if (claimed.count !== 1) throw new InvitationNotAvailableError();
}

export function createPrismaMemberManagementRepository(prisma: PrismaClient): MemberManagementRepository {
  /**
   * Alterações que podem tirar um Proprietário rodam em transação serializável
   * e conferem, ao final, que ainda existe Proprietário ativo. Serializável
   * impede que duas alterações simultâneas passem cada uma na sua checagem e
   * juntas deixem a empresa sem nenhum. Conflito de serialização: nova tentativa.
   */
  const withOwnerGuard = async (companyId: string, work: (tx: Prisma.TransactionClient) => Promise<void>) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await prisma.$transaction(
          async (tx) => {
            await work(tx);
            const owners = await tx.membership.count({
              where: { companyId, status: "ACTIVE", roles: { some: { role: { key: OWNER_ROLE_KEY } } } },
            });
            if (owners === 0) throw new LastOwnerError();
          },
          { isolationLevel: "Serializable" },
        );
        return;
      } catch (error) {
        if (errorCode(error) === "P2034" && attempt < 3) continue;
        throw error;
      }
    }
  };

  return {
    async listRoles(companyId) {
      const rows = await prisma.role.findMany({
        where: { companyId },
        select: {
          key: true,
          name: true,
          description: true,
          isSystem: true,
          permissions: { select: { permission: { select: { key: true } } } },
          _count: { select: { users: { where: { membership: { status: "ACTIVE" } } } } },
        },
      });

      return rows
        .sort((a, b) => systemRoleOrder(a.key) - systemRoleOrder(b.key) || a.name.localeCompare(b.name, "pt-BR"))
        .map((row) => ({
          key: row.key,
          name: row.name,
          description: row.description,
          isSystem: row.isSystem,
          permissions: row.permissions.map((grant) => grant.permission.key).sort(),
          memberCount: row._count.users,
        }));
    },

    findRoles(companyId, roleKeys) {
      return prisma.role.findMany({ where: { companyId, key: { in: [...roleKeys] } }, select: { id: true, key: true } });
    },

    async findMemberState(companyId, userId) {
      const row = await prisma.membership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: { status: true, roles: { select: { role: { select: { key: true } } } } },
      });
      return row ? { status: row.status, roleKeys: row.roles.map((assignment) => assignment.role.key).sort() } : null;
    },

    async isMemberByEmail(companyId, email) {
      const count = await prisma.membership.count({
        where: { companyId, status: { not: "REMOVED" }, user: { email } },
      });
      return count > 0;
    },

    async createInvitation(input) {
      const row = await prisma.$transaction(async (tx) => {
        await tx.companyInvitation.updateMany({
          where: { companyId: input.companyId, email: input.email, acceptedAt: null, revokedAt: null },
          data: { revokedAt: input.at },
        });
        return tx.companyInvitation.create({
          data: {
            companyId: input.companyId,
            email: input.email,
            roleId: input.roleId,
            tokenHash: input.tokenHash,
            invitedByUserId: input.invitedByUserId,
            expiresAt: input.expiresAt,
          },
          select: invitationSelect,
        });
      });
      return toInvitation(row);
    },

    async listPendingInvitations(companyId, at) {
      const rows = await prisma.companyInvitation.findMany({
        where: { companyId, ...pendingWhere(at) },
        orderBy: { createdAt: "desc" },
        select: invitationSelect,
      });
      return rows.map(toInvitation);
    },

    async revokeInvitation(companyId, invitationId, at) {
      const { count } = await prisma.companyInvitation.updateMany({
        where: { id: invitationId, companyId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: at },
      });
      return count > 0;
    },

    async findPendingInvitation(tokenHash, at) {
      const row = await prisma.companyInvitation.findFirst({
        where: { tokenHash, ...pendingWhere(at) },
        select: {
          id: true,
          companyId: true,
          email: true,
          roleId: true,
          expiresAt: true,
          role: { select: { key: true, name: true } },
          company: { select: { name: true, status: true, deletedAt: true } },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        companyId: row.companyId,
        companyName: row.company.name,
        companyActive: row.company.status === "ACTIVE" && row.company.deletedAt === null,
        email: row.email,
        roleId: row.roleId,
        roleKey: row.role.key,
        roleName: row.role.name,
        expiresAt: row.expiresAt,
      };
    },

    async acceptInvitation(input) {
      await prisma.$transaction(async (tx) => {
        await claimInvitation(tx, input);

        const existing = await tx.membership.findUnique({
          where: { companyId_userId: { companyId: input.companyId, userId: input.userId } },
          select: { status: true },
        });
        if (existing && existing.status !== "REMOVED") throw new AlreadyMemberError();

        if (existing) {
          await tx.membership.update({
            where: { companyId_userId: { companyId: input.companyId, userId: input.userId } },
            data: { status: "ACTIVE" },
          });
        } else {
          await tx.membership.create({ data: { companyId: input.companyId, userId: input.userId, status: "ACTIVE" } });
        }

        await tx.userRole.deleteMany({ where: { companyId: input.companyId, userId: input.userId } });
        await tx.userRole.create({ data: { companyId: input.companyId, userId: input.userId, roleId: input.roleId } });
      });
    },

    async createAccountFromInvitation(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash: input.passwordHash,
              cpfLookupHash: input.cpf?.lookupHash ?? null,
              cpfEncrypted: input.cpf?.encrypted ?? null,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          await claimInvitation(tx, { invitationId: input.invitationId, companyId: input.companyId, userId: user.id, at: input.at });
          await tx.membership.create({ data: { companyId: input.companyId, userId: user.id, status: "ACTIVE" } });
          await tx.userRole.create({ data: { companyId: input.companyId, userId: user.id, roleId: input.roleId } });
          return { userId: user.id };
        });
      } catch (error) {
        if (errorCode(error) === "P2002") throw new AccountAlreadyExistsError();
        throw error;
      }
    },

    async replaceMemberRoles(companyId, userId, roleIds) {
      await withOwnerGuard(companyId, async (tx) => {
        await tx.userRole.deleteMany({ where: { companyId, userId } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ companyId, userId, roleId })) });
      });
    },

    async setMemberStatus(companyId, userId, status) {
      await withOwnerGuard(companyId, async (tx) => {
        await tx.membership.update({ where: { companyId_userId: { companyId, userId } }, data: { status } });
        // Removido perde os perfis: se voltar, volta com o perfil do novo convite.
        if (status === "REMOVED") await tx.userRole.deleteMany({ where: { companyId, userId } });
      });
    },
  };
}
