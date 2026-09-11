import {
  type BranchRecord,
  BranchNotFoundError,
  type CompanyManagementRepository,
  type DepartmentRecord,
  ResourceConflictError,
  ResourceInUseError,
} from "@/application/ports/company-management";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

const branchSelect = { id: true, name: true, code: true, createdAt: true, updatedAt: true } as const;

const departmentSelect = {
  id: true,
  name: true,
  branchId: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { name: true } },
} as const;

type DepartmentRow = {
  id: string;
  name: string;
  branchId: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch: { name: string } | null;
};

const toDepartment = (row: DepartmentRow): DepartmentRecord => ({
  id: row.id,
  name: row.name,
  branchId: row.branchId,
  branchName: row.branch?.name ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Erro de unicidade do Postgres, via Prisma. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

/**
 * Escritas de empresa, filiais e setores.
 *
 * Duas consequências da exclusão lógica são tratadas aqui: como as linhas
 * excluídas continuam na tabela, todas as buscas filtram `deletedAt: null`, e
 * a exclusão de uma filial libera seu `code` (a unicidade é por empresa e não
 * distingue registro excluído). Pelo mesmo motivo o `Restrict` do banco não
 * protege contra apagar algo ainda em uso: os vínculos são conferidos em
 * transação antes de marcar a exclusão.
 */
export function createPrismaCompanyManagementRepository(prisma: PrismaClient): CompanyManagementRepository {
  const liveBranch = async (tx: Prisma.TransactionClient, companyId: string, branchId: string) =>
    tx.branch.findFirst({ where: { id: branchId, companyId, deletedAt: null }, select: { id: true } });

  /** A filial precisa ser da mesma empresa e não estar excluída. */
  const assertBranch = async (tx: Prisma.TransactionClient, companyId: string, branchId: string | null) => {
    if (branchId && !(await liveBranch(tx, companyId, branchId))) throw new BranchNotFoundError();
  };

  return {
    async updateCompany(companyId, input) {
      const { count } = await prisma.company.updateMany({
        where: { id: companyId, deletedAt: null },
        data: { name: input.name, legalName: input.legalName, taxId: input.taxId },
      });
      if (count === 0) return null;

      return prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { id: true, name: true, legalName: true, taxId: true, slug: true, status: true, createdAt: true },
      });
    },

    listBranches(companyId) {
      return prisma.branch.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { name: "asc" },
        select: branchSelect,
      });
    },

    findBranch(companyId, branchId) {
      return prisma.branch.findFirst({
        where: { id: branchId, companyId, deletedAt: null },
        select: branchSelect,
      });
    },

    async createBranch(companyId, input) {
      try {
        return await prisma.branch.create({
          data: { companyId, name: input.name, code: input.code },
          select: branchSelect,
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new ResourceConflictError();
        throw error;
      }
    },

    async updateBranch(companyId, branchId, input): Promise<BranchRecord | null> {
      try {
        const { count } = await prisma.branch.updateMany({
          where: { id: branchId, companyId, deletedAt: null },
          data: { name: input.name, code: input.code },
        });
        if (count === 0) return null;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ResourceConflictError();
        throw error;
      }

      return prisma.branch.findFirst({ where: { id: branchId, companyId }, select: branchSelect });
    },

    deleteBranch(companyId, branchId, at) {
      return prisma.$transaction(async (tx) => {
        if (!(await liveBranch(tx, companyId, branchId))) return false;

        const [departments, documents] = await Promise.all([
          tx.department.count({ where: { companyId, branchId, deletedAt: null } }),
          tx.document.count({ where: { companyId, branchId, deletedAt: null } }),
        ]);
        if (departments > 0 || documents > 0) throw new ResourceInUseError();

        // O código volta a ficar disponível para uma nova filial.
        await tx.branch.updateMany({ where: { id: branchId, companyId }, data: { deletedAt: at, code: null } });
        return true;
      });
    },

    async listDepartments(companyId) {
      const rows = await prisma.department.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { name: "asc" },
        select: departmentSelect,
      });
      return rows.map(toDepartment);
    },

    async findDepartment(companyId, departmentId) {
      const row = await prisma.department.findFirst({
        where: { id: departmentId, companyId, deletedAt: null },
        select: departmentSelect,
      });
      return row ? toDepartment(row) : null;
    },

    createDepartment(companyId, input) {
      return prisma.$transaction(async (tx) => {
        await assertBranch(tx, companyId, input.branchId);
        const row = await tx.department.create({
          data: { companyId, name: input.name, branchId: input.branchId },
          select: departmentSelect,
        });
        return toDepartment(row);
      });
    },

    updateDepartment(companyId, departmentId, input) {
      return prisma.$transaction(async (tx) => {
        await assertBranch(tx, companyId, input.branchId);

        const { count } = await tx.department.updateMany({
          where: { id: departmentId, companyId, deletedAt: null },
          data: { name: input.name, branchId: input.branchId },
        });
        if (count === 0) return null;

        const row = await tx.department.findFirst({
          where: { id: departmentId, companyId },
          select: departmentSelect,
        });
        return row ? toDepartment(row) : null;
      });
    },

    deleteDepartment(companyId, departmentId, at) {
      return prisma.$transaction(async (tx) => {
        const department = await tx.department.findFirst({
          where: { id: departmentId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (!department) return false;

        const documents = await tx.document.count({ where: { companyId, departmentId, deletedAt: null } });
        if (documents > 0) throw new ResourceInUseError();

        await tx.department.updateMany({ where: { id: departmentId, companyId }, data: { deletedAt: at } });
        return true;
      });
    },
  };
}
