import type { CompanySummary } from "./access-control";

/** Violação de unicidade (ex.: código de filial já usado na empresa). */
export class ResourceConflictError extends Error {
  constructor() {
    super("registro já existe");
    this.name = "ResourceConflictError";
  }
}

/**
 * Registro ainda referenciado por dados vivos (ex.: filial com setores ou
 * documentos). A exclusão é lógica, então o banco não impede sozinho.
 */
export class ResourceInUseError extends Error {
  constructor() {
    super("registro em uso");
    this.name = "ResourceInUseError";
  }
}

/** Filial de outra empresa, excluída ou inexistente. */
export class BranchNotFoundError extends Error {
  constructor() {
    super("filial não encontrada");
    this.name = "BranchNotFoundError";
  }
}

export interface BranchRecord {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DepartmentRecord {
  readonly id: string;
  readonly name: string;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CompanyProfileInput {
  readonly name: string;
  readonly legalName: string | null;
  readonly taxId: string | null;
}

export interface BranchInput {
  readonly name: string;
  readonly code: string | null;
}

export interface DepartmentInput {
  readonly name: string;
  readonly branchId: string | null;
}

/**
 * Escritas da empresa ativa. Toda operação recebe o `companyId` do contexto
 * autorizado e nunca alcança registros de outra empresa: um id de fora
 * simplesmente não é encontrado.
 */
export interface CompanyManagementRepository {
  updateCompany(companyId: string, input: CompanyProfileInput): Promise<CompanySummary | null>;

  listBranches(companyId: string): Promise<BranchRecord[]>;
  findBranch(companyId: string, branchId: string): Promise<BranchRecord | null>;
  /** @throws {ResourceConflictError} código já usado na empresa. */
  createBranch(companyId: string, input: BranchInput): Promise<BranchRecord>;
  updateBranch(companyId: string, branchId: string, input: BranchInput): Promise<BranchRecord | null>;
  /** @throws {ResourceInUseError} filial com setores ou documentos ativos. */
  deleteBranch(companyId: string, branchId: string, at: Date): Promise<boolean>;

  listDepartments(companyId: string): Promise<DepartmentRecord[]>;
  findDepartment(companyId: string, departmentId: string): Promise<DepartmentRecord | null>;
  /** @throws {BranchNotFoundError} `branchId` não pertence à empresa. */
  createDepartment(companyId: string, input: DepartmentInput): Promise<DepartmentRecord>;
  updateDepartment(companyId: string, departmentId: string, input: DepartmentInput): Promise<DepartmentRecord | null>;
  /** @throws {ResourceInUseError} setor com documentos ativos. */
  deleteDepartment(companyId: string, departmentId: string, at: Date): Promise<boolean>;
}
