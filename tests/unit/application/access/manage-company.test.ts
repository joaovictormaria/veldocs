import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { type CompanyManagement, createCompanyManagement } from "@/application/access/manage-company";
import {
  type BranchRecord,
  BranchNotFoundError,
  type CompanyManagementRepository,
  type DepartmentRecord,
  ResourceConflictError,
  ResourceInUseError,
} from "@/application/ports/company-management";
import { createFakeAudit, createFakeClock } from "../auth/fakes";

const COMPANY = "company-1";
const OTHER_COMPANY = "company-2";
const request = { ipAddress: "203.0.113.7", userAgent: "vitest" };

const contextFor = (companyId: string): AuthorizedContext => ({
  companyId,
  userId: "user-1",
  roleKeys: ["ADMIN"],
  permissions: ["company.update", "branches.manage", "departments.manage"],
});

/**
 * Repositório em memória com as mesmas regras do banco: escopo por empresa,
 * código de filial único e recusa de excluir registro em uso.
 */
function createFakeRepository() {
  const companies = new Map<string, { name: string; legalName: string | null; taxId: string | null }>([
    [COMPANY, { name: "Empresa A", legalName: null, taxId: null }],
    [OTHER_COMPANY, { name: "Empresa B", legalName: null, taxId: null }],
  ]);
  const branches = new Map<string, BranchRecord & { companyId: string }>();
  const departments = new Map<string, DepartmentRecord & { companyId: string }>();
  const documentsByBranch = new Set<string>();
  const documentsByDepartment = new Set<string>();
  const scopes: string[] = [];

  const at = new Date("2026-09-11T12:00:00.000Z");
  const scoped = <T extends { companyId: string }>(rows: Map<string, T>, companyId: string, id: string) => {
    const row = rows.get(id);
    return row && row.companyId === companyId ? row : null;
  };

  const repository: CompanyManagementRepository = {
    async updateCompany(companyId, input) {
      scopes.push(`updateCompany:${companyId}`);
      const company = companies.get(companyId);
      if (!company) return null;
      Object.assign(company, input);
      return { id: companyId, slug: "empresa", status: "ACTIVE", createdAt: at, ...company };
    },

    async listBranches(companyId) {
      scopes.push(`listBranches:${companyId}`);
      return [...branches.values()].filter((branch) => branch.companyId === companyId);
    },
    async findBranch(companyId, branchId) {
      scopes.push(`findBranch:${companyId}`);
      return scoped(branches, companyId, branchId);
    },
    async createBranch(companyId, input) {
      scopes.push(`createBranch:${companyId}`);
      if (input.code && [...branches.values()].some((b) => b.companyId === companyId && b.code === input.code)) {
        throw new ResourceConflictError();
      }
      const branch = { id: randomUUID(), companyId, ...input, createdAt: at, updatedAt: at };
      branches.set(branch.id, branch);
      return branch;
    },
    async updateBranch(companyId, branchId, input) {
      scopes.push(`updateBranch:${companyId}`);
      const branch = scoped(branches, companyId, branchId);
      if (!branch) return null;
      if (input.code && [...branches.values()].some((b) => b.id !== branchId && b.companyId === companyId && b.code === input.code)) {
        throw new ResourceConflictError();
      }
      const updated = { ...branch, ...input };
      branches.set(branchId, updated);
      return updated;
    },
    async deleteBranch(companyId, branchId) {
      scopes.push(`deleteBranch:${companyId}`);
      const branch = scoped(branches, companyId, branchId);
      if (!branch) return false;
      const hasDepartments = [...departments.values()].some((d) => d.branchId === branchId);
      if (hasDepartments || documentsByBranch.has(branchId)) throw new ResourceInUseError();
      branches.delete(branchId);
      return true;
    },

    async listDepartments(companyId) {
      scopes.push(`listDepartments:${companyId}`);
      return [...departments.values()].filter((department) => department.companyId === companyId);
    },
    async findDepartment(companyId, departmentId) {
      scopes.push(`findDepartment:${companyId}`);
      return scoped(departments, companyId, departmentId);
    },
    async createDepartment(companyId, input) {
      scopes.push(`createDepartment:${companyId}`);
      const branch = input.branchId ? scoped(branches, companyId, input.branchId) : null;
      if (input.branchId && !branch) throw new BranchNotFoundError();
      const department = {
        id: randomUUID(),
        companyId,
        name: input.name,
        branchId: input.branchId,
        branchName: branch?.name ?? null,
        createdAt: at,
        updatedAt: at,
      };
      departments.set(department.id, department);
      return department;
    },
    async updateDepartment(companyId, departmentId, input) {
      scopes.push(`updateDepartment:${companyId}`);
      const branch = input.branchId ? scoped(branches, companyId, input.branchId) : null;
      if (input.branchId && !branch) throw new BranchNotFoundError();
      const department = scoped(departments, companyId, departmentId);
      if (!department) return null;
      const updated = { ...department, name: input.name, branchId: input.branchId, branchName: branch?.name ?? null };
      departments.set(departmentId, updated);
      return updated;
    },
    async deleteDepartment(companyId, departmentId) {
      scopes.push(`deleteDepartment:${companyId}`);
      const department = scoped(departments, companyId, departmentId);
      if (!department) return false;
      if (documentsByDepartment.has(departmentId)) throw new ResourceInUseError();
      departments.delete(departmentId);
      return true;
    },
  };

  return { repository, scopes, documentsByBranch, documentsByDepartment, companies };
}

let fake: ReturnType<typeof createFakeRepository>;
let audit: ReturnType<typeof createFakeAudit>;
let management: CompanyManagement;
const context = contextFor(COMPANY);

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

beforeEach(() => {
  fake = createFakeRepository();
  audit = createFakeAudit();
  management = createCompanyManagement({
    repository: fake.repository,
    audit: audit.audit,
    now: createFakeClock().now,
  });
});

describe("dados da empresa", () => {
  it("salva o CNPJ somente com dígitos e registra a auditoria", async () => {
    const company = unwrap(
      await management.updateCompany(
        context,
        { name: "  Empresa Renomeada  ", legalName: "Empresa Renomeada LTDA", taxId: "12.345.678/0001-95" },
        request,
      ),
    );

    expect(company.name).toBe("Empresa Renomeada");
    expect(company.taxId).toBe("12345678000195");
    expect(audit.events).toEqual([
      expect.objectContaining({
        companyId: COMPANY,
        actorUserId: "user-1",
        action: "company.updated",
        entityType: "Company",
        entityId: COMPANY,
        ipAddress: "203.0.113.7",
      }),
    ]);
  });

  it("trata campo vazio como ausente", async () => {
    const company = unwrap(await management.updateCompany(context, { name: "Empresa A", legalName: "", taxId: "" }, request));
    expect(company.legalName).toBeNull();
    expect(company.taxId).toBeNull();
  });

  it("recusa nome curto e CNPJ inválido, sem auditar", async () => {
    const result = await management.updateCompany(context, { name: "A", taxId: "12345678000196" }, request);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.reason).toBe("invalid_input");
    expect(result.issues?.map((issue) => issue.field).sort()).toEqual(["name", "taxId"]);
    expect(audit.events).toEqual([]);
  });
});

describe("filiais", () => {
  it("cria e edita, auditando cada escrita", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Matriz", code: "mtz" }, request));
    const updated = unwrap(await management.updateBranch(context, branch.id, { name: "Matriz SP" }, request));

    expect(updated.name).toBe("Matriz SP");
    expect(audit.events.map((event) => event.action)).toEqual(["branch.created", "branch.updated"]);
    expect(audit.events.every((event) => event.entityId === branch.id)).toBe(true);
  });

  it("recusa código repetido na mesma empresa", async () => {
    await management.createBranch(context, { name: "Matriz", code: "MTZ" }, request);
    const conflict = await management.createBranch(context, { name: "Outra", code: "MTZ" }, request);

    expect(conflict).toEqual({ ok: false, reason: "conflict" });
    expect(audit.events.map((event) => event.action)).toEqual(["branch.created"]);
  });

  it("recusa código com caracteres fora do permitido", async () => {
    const result = await management.createBranch(context, { name: "Matriz", code: "MTZ SP" }, request);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.issues?.[0]?.field).toBe("code");
  });

  it("não exclui filial com setores e não audita a tentativa", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Matriz", code: null }, request));
    await management.createDepartment(context, { name: "Financeiro", branchId: branch.id }, request);
    audit.events.length = 0;

    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: false, reason: "in_use" });
    expect(audit.events).toEqual([]);
  });

  it("não exclui filial com documentos", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Matriz", code: null }, request));
    fake.documentsByBranch.add(branch.id);

    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: false, reason: "in_use" });
  });

  it("exclui filial livre e audita", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Matriz", code: null }, request));
    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: true, data: null });
    expect(audit.events.at(-1)?.action).toBe("branch.deleted");
  });

  it("id de outra empresa não é encontrado", async () => {
    const branch = unwrap(await management.createBranch(contextFor(OTHER_COMPANY), { name: "Matriz B", code: null }, request));
    audit.events.length = 0;

    expect(await management.findBranch(context, branch.id)).toBeNull();
    expect(await management.updateBranch(context, branch.id, { name: "Invadida" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: false, reason: "not_found" });
    expect(audit.events).toEqual([]);
  });
});

describe("setores", () => {
  it("aceita setor da empresa inteira, sem filial", async () => {
    const department = unwrap(await management.createDepartment(context, { name: "Jurídico", branchId: null }, request));

    expect(department.branchId).toBeNull();
    expect(department.branchName).toBeNull();
    expect(audit.events.at(-1)?.action).toBe("department.created");
  });

  it("recusa filial de outra empresa como se não existisse", async () => {
    const outsider = unwrap(
      await management.createBranch(contextFor(OTHER_COMPANY), { name: "Matriz B", code: null }, request),
    );
    audit.events.length = 0;

    const result = await management.createDepartment(context, { name: "Financeiro", branchId: outsider.id }, request);

    if (result.ok) throw new Error("esperava recusa");
    expect(result.reason).toBe("invalid_input");
    expect(result.issues).toEqual([{ field: "branchId", message: "filial não encontrada" }]);
    expect(audit.events).toEqual([]);
  });

  it("recusa branchId que nem é uuid", async () => {
    const result = await management.createDepartment(context, { name: "Financeiro", branchId: "não-é-uuid" }, request);
    if (result.ok) throw new Error("esperava recusa");
    expect(result.issues?.[0]?.field).toBe("branchId");
  });

  it("não exclui setor com documentos", async () => {
    const department = unwrap(await management.createDepartment(context, { name: "Financeiro", branchId: null }, request));
    fake.documentsByDepartment.add(department.id);

    expect(await management.deleteDepartment(context, department.id, request)).toEqual({ ok: false, reason: "in_use" });
  });
});

describe("escopo por empresa", () => {
  it("o repositório só recebe a empresa do contexto autorizado", async () => {
    await management.listBranches(context);
    await management.listDepartments(context);
    await management.createBranch(context, { name: "Matriz", code: null }, request);
    await management.updateCompany(context, { name: "Empresa A" }, request);

    expect(fake.scopes).toEqual([
      `listBranches:${COMPANY}`,
      `listDepartments:${COMPANY}`,
      `createBranch:${COMPANY}`,
      `updateCompany:${COMPANY}`,
    ]);
  });
});
