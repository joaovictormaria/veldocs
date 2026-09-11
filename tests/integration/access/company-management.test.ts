import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createCompanyManagement } from "@/application/access/manage-company";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaCompanyManagementRepository } from "@/infrastructure/database/prisma-company-management-repository";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";

const request = { ipAddress: "203.0.113.30", userAgent: "vitest" };

let prisma: PrismaClient;
let management: ReturnType<typeof createCompanyManagement>;
let tenant: Awaited<ReturnType<typeof createTenantFixture>>;
let other: Awaited<ReturnType<typeof createTenantFixture>>;
let context: AuthorizedContext;

const contextFor = (companyId: string, userId: string): AuthorizedContext => ({
  companyId,
  userId,
  roleKeys: ["ADMIN"],
  permissions: ["company.update", "branches.manage", "departments.manage"],
});

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  tenant = await createTenantFixture(prisma, `a${randomUUID().slice(0, 4)}`);
  other = await createTenantFixture(prisma, `b${randomUUID().slice(0, 4)}`);
  context = contextFor(tenant.company.id, tenant.user.id);
  management = createCompanyManagement({
    repository: createPrismaCompanyManagementRepository(prisma),
    audit: createPrismaAuditLogger(prisma),
    now: () => new Date(),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("gestão da empresa com PostgreSQL", () => {
  it("atualiza os dados cadastrais e grava a auditoria", async () => {
    const company = unwrap(
      await management.updateCompany(
        context,
        { name: "Empresa Atualizada", legalName: "Empresa Atualizada LTDA", taxId: "12.345.678/0001-95" },
        request,
      ),
    );

    expect(company.name).toBe("Empresa Atualizada");

    const saved = await prisma.company.findUniqueOrThrow({ where: { id: tenant.company.id } });
    expect(saved.taxId).toBe("12345678000195");

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "company.updated" } });
    expect(log.companyId).toBe(tenant.company.id);
    expect(log.actorUserId).toBe(tenant.user.id);
    expect(log.entityId).toBe(tenant.company.id);
  });

  it("não alcança a empresa de outro tenant", async () => {
    await management.updateCompany(contextFor(other.company.id, other.user.id), { name: "Só a B" }, request);

    const untouched = await prisma.company.findUniqueOrThrow({ where: { id: tenant.company.id } });
    expect(untouched.name).toBe(tenant.company.name);
  });
});

describe("filiais com PostgreSQL", () => {
  it("recusa código repetido na empresa, mas permite o mesmo código em outra", async () => {
    const conflict = await management.createBranch(context, { name: "Outra matriz", code: "MTZ" }, request);
    expect(conflict).toEqual({ ok: false, reason: "conflict" });

    // A empresa vizinha já usa "MTZ" (fixture) e isso não interfere.
    const ok = await management.createBranch(context, { name: "Filial Sul", code: "SUL" }, request);
    expect(ok.ok).toBe(true);
  });

  it("permite várias filiais sem código", async () => {
    expect((await management.createBranch(context, { name: "Sem código 1", code: null }, request)).ok).toBe(true);
    expect((await management.createBranch(context, { name: "Sem código 2", code: "" }, request)).ok).toBe(true);
  });

  it("não exclui filial com setor ativo", async () => {
    expect(await management.deleteBranch(context, tenant.branch.id, request)).toEqual({ ok: false, reason: "in_use" });

    const stillThere = await prisma.branch.findUniqueOrThrow({ where: { id: tenant.branch.id } });
    expect(stillThere.deletedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "branch.deleted" } })).toBe(0);
  });

  it("não exclui filial com documento ativo", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Filial Norte", code: "NOR" }, request));
    await prisma.document.create({
      data: { companyId: tenant.company.id, branchId: branch.id, title: "Alvará" },
    });

    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: false, reason: "in_use" });
  });

  it("ignora vínculos já excluídos ao apagar a filial", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Filial Oeste", code: "OES" }, request));
    const department = unwrap(await management.createDepartment(context, { name: "Compras", branchId: branch.id }, request));
    await management.deleteDepartment(context, department.id, request);

    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: true, data: null });
  });

  it("exclusão é lógica e devolve o código para reuso", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Filial Leste", code: "LES" }, request));
    expect(await management.deleteBranch(context, branch.id, request)).toEqual({ ok: true, data: null });

    const row = await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.code).toBeNull();

    // O código volta a ficar livre; sem isso, ficaria bloqueado para sempre.
    const reused = await management.createBranch(context, { name: "Nova Leste", code: "LES" }, request);
    expect(reused.ok).toBe(true);

    expect(await management.findBranch(context, branch.id)).toBeNull();
    expect((await management.listBranches(context)).map((item) => item.name)).not.toContain("Filial Leste");
  });

  it("id de filial de outra empresa se comporta como inexistente", async () => {
    expect(await management.findBranch(context, other.branch.id)).toBeNull();
    expect(await management.updateBranch(context, other.branch.id, { name: "Invadida" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await management.deleteBranch(context, other.branch.id, request)).toEqual({ ok: false, reason: "not_found" });

    const untouched = await prisma.branch.findUniqueOrThrow({ where: { id: other.branch.id } });
    expect(untouched.name).toBe(other.branch.name);
    expect(untouched.deletedAt).toBeNull();
  });
});

describe("setores com PostgreSQL", () => {
  it("cria setor ligado à filial e traz o nome dela na listagem", async () => {
    const department = unwrap(
      await management.createDepartment(context, { name: "Compras", branchId: tenant.branch.id }, request),
    );

    expect(department.branchName).toBe(tenant.branch.name);
    const listed = (await management.listDepartments(context)).find((item) => item.id === department.id);
    expect(listed?.branchName).toBe(tenant.branch.name);
  });

  it("recusa filial de outra empresa", async () => {
    const result = await management.createDepartment(context, { name: "Compras", branchId: other.branch.id }, request);

    if (result.ok) throw new Error("esperava recusa");
    expect(result.reason).toBe("invalid_input");
    expect(result.issues).toEqual([{ field: "branchId", message: "filial não encontrada" }]);
  });

  it("recusa filial já excluída", async () => {
    const branch = unwrap(await management.createBranch(context, { name: "Temporária", code: null }, request));
    await management.deleteBranch(context, branch.id, request);

    const result = await management.createDepartment(context, { name: "Compras", branchId: branch.id }, request);
    expect(result.ok).toBe(false);
  });

  it("desvincula o setor da filial ao editar", async () => {
    const department = unwrap(
      await management.createDepartment(context, { name: "Compras", branchId: tenant.branch.id }, request),
    );

    const updated = unwrap(await management.updateDepartment(context, department.id, { name: "Compras" }, request));
    expect(updated.branchId).toBeNull();
    expect(updated.branchName).toBeNull();
  });

  it("não exclui setor com documento ativo", async () => {
    await prisma.document.create({
      data: { companyId: tenant.company.id, departmentId: tenant.department.id, title: "Contrato" },
    });

    expect(await management.deleteDepartment(context, tenant.department.id, request)).toEqual({
      ok: false,
      reason: "in_use",
    });
  });

  it("exclui setor livre e registra a auditoria", async () => {
    expect(await management.deleteDepartment(context, tenant.department.id, request)).toEqual({ ok: true, data: null });

    const row = await prisma.department.findUniqueOrThrow({ where: { id: tenant.department.id } });
    expect(row.deletedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "department.deleted" } });
    expect(log.entityId).toBe(tenant.department.id);
  });

  it("id de setor de outra empresa se comporta como inexistente", async () => {
    expect(await management.findDepartment(context, other.department.id)).toBeNull();
    expect(await management.deleteDepartment(context, other.department.id, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
