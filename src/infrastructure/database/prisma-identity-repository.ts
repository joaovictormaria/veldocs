import { AccountAlreadyExistsError } from "@/application/auth/shared";
import type { IdentityRepository, UserCredentials } from "@/application/ports/identity-repository";
import type { PrismaClient } from "@/generated/prisma/client";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

const credentialsSelect = { id: true, status: true, passwordHash: true, deletedAt: true } as const;

type CredentialsRow = { id: string; status: "ACTIVE" | "DISABLED"; passwordHash: string | null; deletedAt: Date | null };

const toCredentials = (row: CredentialsRow | null): UserCredentials | null =>
  row && !row.deletedAt ? { userId: row.id, status: row.status, passwordHash: row.passwordHash } : null;

export function createPrismaIdentityRepository(prisma: PrismaClient): IdentityRepository {
  return {
    async findCredentialsByEmail(email) {
      return toCredentials(await prisma.user.findUnique({ where: { email }, select: credentialsSelect }));
    },

    async findCredentialsByCpfLookupHash(lookupHash) {
      return toCredentials(
        await prisma.user.findUnique({ where: { cpfLookupHash: lookupHash }, select: credentialsSelect }),
      );
    },

    async createAccountWithCompany(input) {
      try {
        return await prisma.$transaction(async (tx) => {
          await tx.permission.createMany({
            data: Object.entries(input.permissionCatalog).map(([key, description]) => ({ key, description })),
            skipDuplicates: true,
          });
          const permissions = await tx.permission.findMany({
            where: { key: { in: Object.keys(input.permissionCatalog) } },
            select: { id: true, key: true },
          });
          const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

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
          const company = await tx.company.create({
            data: { name: input.company.name, slug: input.company.slug },
            select: { id: true },
          });
          await tx.membership.create({ data: { companyId: company.id, userId: user.id, status: "ACTIVE" } });

          for (const role of input.roles) {
            const created = await tx.role.create({
              data: {
                companyId: company.id,
                key: role.key,
                name: role.name,
                description: role.description,
                isSystem: true,
              },
              select: { id: true },
            });

            await tx.rolePermission.createMany({
              data: role.permissions.map((key) => {
                const permissionId = permissionIdByKey.get(key);
                if (!permissionId) throw new Error(`permissão fora do catálogo: ${key}`);
                return { roleId: created.id, permissionId };
              }),
            });

            if (role.key === input.creatorRoleKey) {
              await tx.userRole.create({ data: { companyId: company.id, userId: user.id, roleId: created.id } });
            }
          }

          return { userId: user.id, companyId: company.id };
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new AccountAlreadyExistsError();
        throw error;
      }
    },

    findActiveProfile(userId) {
      return prisma.user.findFirst({
        where: { id: userId, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, email: true },
      });
    },

    async listMemberships(userId) {
      const rows = await prisma.membership.findMany({
        where: { userId, company: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        select: {
          companyId: true,
          status: true,
          company: { select: { name: true } },
          roles: { select: { role: { select: { key: true } } } },
        },
      });

      return rows.map((row) => ({
        companyId: row.companyId,
        companyName: row.company.name,
        status: row.status,
        roleKeys: row.roles.map((assignment) => assignment.role.key),
      }));
    },

    async recordSuccessfulLogin(userId, at) {
      await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
    },
  };
}
