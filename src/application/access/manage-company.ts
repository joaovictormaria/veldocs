import { z } from "zod";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { CompanySummary } from "@/application/ports/access-control";
import type { AuditLogger } from "@/application/ports/audit-logger";
import {
  type BranchRecord,
  BranchNotFoundError,
  type CompanyManagementRepository,
  type DepartmentRecord,
  ResourceConflictError,
  ResourceInUseError,
} from "@/application/ports/company-management";
import { cnpjSchema } from "@/domain/company/cnpj";
import type { AuthorizedContext } from "./authorize";

export const COMPANY_MANAGEMENT_AUDIT_ACTIONS = {
  companyUpdated: "company.updated",
  branchCreated: "branch.created",
  branchUpdated: "branch.updated",
  branchDeleted: "branch.deleted",
  departmentCreated: "department.created",
  departmentUpdated: "department.updated",
  departmentDeleted: "department.deleted",
} as const;

/** Campo opcional: ausente, nulo ou string vazia viram `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal("").transform(() => null), schema])
    .nullish()
    .transform((value) => value ?? null);

export const companyProfileInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe o nome da empresa" }).max(200),
  legalName: optional(z.string().trim().min(2, { error: "razão social muito curta" }).max(200)),
  taxId: optional(cnpjSchema),
});

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe o nome da filial" }).max(200),
  code: optional(
    z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9._-]+$/, { error: "use apenas letras, números, ponto, hífen ou sublinhado" }),
  ),
});

export const departmentInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe o nome do setor" }).max(200),
  branchId: optional(z.uuid({ error: "filial não encontrada" })),
});

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

export type WriteFailure = "invalid_input" | "not_found" | "conflict" | "in_use";

export type WriteResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: WriteFailure; readonly issues?: readonly ValidationIssue[] };

const invalid = (issues: readonly ValidationIssue[]): WriteResult<never> => ({
  ok: false,
  reason: "invalid_input",
  issues,
});

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const BRANCH_NOT_FOUND: readonly ValidationIssue[] = [{ field: "branchId", message: "filial não encontrada" }];

/**
 * Escritas de empresa, filiais e setores. Como nas consultas, a empresa vem
 * sempre do `AuthorizedContext` — nunca da requisição — e cada escrita
 * registra um evento de auditoria.
 */
export function createCompanyManagement(deps: {
  readonly repository: CompanyManagementRepository;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  const record = (
    context: AuthorizedContext,
    request: RequestContext,
    action: string,
    entityType: string,
    entityId: string,
  ) =>
    deps.audit.record({
      companyId: context.companyId,
      actorUserId: context.userId,
      action,
      entityType,
      entityId,
      ...auditContext(request),
    });

  return {
    async updateCompany(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<CompanySummary>> {
      const input = companyProfileInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const company = await deps.repository.updateCompany(context.companyId, input.data);
      if (!company) return { ok: false, reason: "not_found" };

      await record(context, request, COMPANY_MANAGEMENT_AUDIT_ACTIONS.companyUpdated, "Company", context.companyId);
      return { ok: true, data: company };
    },

    listBranches: (context: AuthorizedContext) => deps.repository.listBranches(context.companyId),

    findBranch: (context: AuthorizedContext, branchId: string) =>
      deps.repository.findBranch(context.companyId, branchId),

    async createBranch(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<BranchRecord>> {
      const input = branchInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const branch = await deps.repository.createBranch(context.companyId, input.data);
        await record(context, request, COMPANY_MANAGEMENT_AUDIT_ACTIONS.branchCreated, "Branch", branch.id);
        return { ok: true, data: branch };
      } catch (error) {
        if (error instanceof ResourceConflictError) return { ok: false, reason: "conflict" };
        throw error;
      }
    },

    async updateBranch(
      context: AuthorizedContext,
      branchId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<BranchRecord>> {
      const input = branchInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const branch = await deps.repository.updateBranch(context.companyId, branchId, input.data);
        if (!branch) return { ok: false, reason: "not_found" };
        await record(context, request, COMPANY_MANAGEMENT_AUDIT_ACTIONS.branchUpdated, "Branch", branch.id);
        return { ok: true, data: branch };
      } catch (error) {
        if (error instanceof ResourceConflictError) return { ok: false, reason: "conflict" };
        throw error;
      }
    },

    async deleteBranch(
      context: AuthorizedContext,
      branchId: string,
      request: RequestContext,
    ): Promise<WriteResult<null>> {
      try {
        const deleted = await deps.repository.deleteBranch(context.companyId, branchId, deps.now());
        if (!deleted) return { ok: false, reason: "not_found" };
        await record(context, request, COMPANY_MANAGEMENT_AUDIT_ACTIONS.branchDeleted, "Branch", branchId);
        return { ok: true, data: null };
      } catch (error) {
        if (error instanceof ResourceInUseError) return { ok: false, reason: "in_use" };
        throw error;
      }
    },

    listDepartments: (context: AuthorizedContext) => deps.repository.listDepartments(context.companyId),

    findDepartment: (context: AuthorizedContext, departmentId: string) =>
      deps.repository.findDepartment(context.companyId, departmentId),

    async createDepartment(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<DepartmentRecord>> {
      const input = departmentInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const department = await deps.repository.createDepartment(context.companyId, input.data);
        await record(
          context,
          request,
          COMPANY_MANAGEMENT_AUDIT_ACTIONS.departmentCreated,
          "Department",
          department.id,
        );
        return { ok: true, data: department };
      } catch (error) {
        if (error instanceof BranchNotFoundError) return invalid(BRANCH_NOT_FOUND);
        throw error;
      }
    },

    async updateDepartment(
      context: AuthorizedContext,
      departmentId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<DepartmentRecord>> {
      const input = departmentInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const department = await deps.repository.updateDepartment(context.companyId, departmentId, input.data);
        if (!department) return { ok: false, reason: "not_found" };
        await record(
          context,
          request,
          COMPANY_MANAGEMENT_AUDIT_ACTIONS.departmentUpdated,
          "Department",
          department.id,
        );
        return { ok: true, data: department };
      } catch (error) {
        if (error instanceof BranchNotFoundError) return invalid(BRANCH_NOT_FOUND);
        throw error;
      }
    },

    async deleteDepartment(
      context: AuthorizedContext,
      departmentId: string,
      request: RequestContext,
    ): Promise<WriteResult<null>> {
      try {
        const deleted = await deps.repository.deleteDepartment(context.companyId, departmentId, deps.now());
        if (!deleted) return { ok: false, reason: "not_found" };
        await record(context, request, COMPANY_MANAGEMENT_AUDIT_ACTIONS.departmentDeleted, "Department", departmentId);
        return { ok: true, data: null };
      } catch (error) {
        if (error instanceof ResourceInUseError) return { ok: false, reason: "in_use" };
        throw error;
      }
    },
  };
}

export type CompanyManagement = ReturnType<typeof createCompanyManagement>;
