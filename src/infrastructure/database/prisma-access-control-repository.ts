import type { AccessControlRepository, CompanyDirectory, CompanyMember } from "@/application/ports/access-control";
import type { PrismaClient } from "@/generated/prisma/client";

export function createPrismaAccessControlRepository(prisma: PrismaClient): AccessControlRepository {
  return {
    async findMembershipAccess(userId, companyId) {
      const row = await prisma.membership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: {
          status: true,
          company: { select: { status: true, deletedAt: true } },
          roles: {
            select: {
              role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
            },
          },
        },
      });
      if (!row) return null;

      const permissions = new Set(
        row.roles.flatMap((assignment) => assignment.role.permissions.map((grant) => grant.permission.key)),
      );

      return {
        membershipStatus: row.status,
        companyActive: row.company.status === "ACTIVE" && row.company.deletedAt === null,
        roleKeys: row.roles.map((assignment) => assignment.role.key).sort(),
        permissions: [...permissions].sort(),
      };
    },
  };
}

const memberSelect = {
  userId: true,
  status: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  roles: { select: { role: { select: { key: true } } } },
} as const;

type MemberRow = {
  userId: string;
  status: CompanyMember["status"];
  createdAt: Date;
  user: { name: string; email: string };
  roles: Array<{ role: { key: string } }>;
};

const toMember = (row: MemberRow): CompanyMember => ({
  userId: row.userId,
  name: row.user.name,
  email: row.user.email,
  status: row.status,
  roleKeys: row.roles.map((assignment) => assignment.role.key).sort(),
  joinedAt: row.createdAt,
});

/** Toda consulta filtra por `companyId`; nunca busca um membro só pelo id da pessoa. */
export function createPrismaCompanyDirectory(prisma: PrismaClient): CompanyDirectory {
  return {
    findCompany(companyId) {
      return prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { id: true, name: true, legalName: true, taxId: true, slug: true, status: true, createdAt: true },
      });
    },

    async listMembers(companyId) {
      const rows = await prisma.membership.findMany({
        where: { companyId },
        orderBy: { createdAt: "asc" },
        select: memberSelect,
      });
      return rows.map(toMember);
    },

    async findMember(companyId, userId) {
      const row = await prisma.membership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: memberSelect,
      });
      return row ? toMember(row) : null;
    },
  };
}
