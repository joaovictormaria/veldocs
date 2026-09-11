import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { sha256Hex } from "@/infrastructure/security/crypto";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";

/**
 * As FKs compostas devem impedir, no próprio banco, qualquer vínculo entre
 * dados de empresas diferentes — inclusive usar uma pessoa que não é membro
 * da empresa.
 */

type Tenant = Awaited<ReturnType<typeof createTenantFixture>>;

const FOREIGN_KEY_VIOLATION = { code: "P2003" };

let prisma: PrismaClient;
let a: Tenant;
let b: Tenant;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  a = await createTenantFixture(prisma, "a");
  b = await createTenantFixture(prisma, "b");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("documentos", () => {
  it("aceita documento com vínculos do mesmo tenant", async () => {
    const document = await prisma.document.create({
      data: {
        companyId: a.company.id,
        title: "Alvará de funcionamento",
        categoryId: a.category.id,
        branchId: a.branch.id,
        departmentId: a.department.id,
        responsibleUserId: a.user.id,
        createdById: a.user.id,
        issueDate: new Date("2026-01-10"),
        expirationDate: new Date("2027-01-10"),
      },
    });

    expect(document.companyId).toBe(a.company.id);
  });

  it.each([
    ["categoria", (other: Tenant) => ({ categoryId: other.category.id })],
    ["filial", (other: Tenant) => ({ branchId: other.branch.id })],
    ["setor", (other: Tenant) => ({ departmentId: other.department.id })],
    ["responsável", (other: Tenant) => ({ responsibleUserId: other.user.id })],
    ["criador", (other: Tenant) => ({ createdById: other.user.id })],
  ])("rejeita documento da empresa A com %s da empresa B", async (_label, linkTo) => {
    await expect(
      prisma.document.create({
        data: { companyId: a.company.id, title: "Tentativa cross-tenant", ...linkTo(b) },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);

    expect(await prisma.document.count()).toBe(0);
  });

  it("rejeita mover documento existente para categoria de outro tenant", async () => {
    const document = await prisma.document.create({
      data: { companyId: a.company.id, title: "Contrato social", categoryId: a.category.id },
    });

    await expect(
      prisma.document.update({ where: { id: document.id }, data: { categoryId: b.category.id } }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);

    const unchanged = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(unchanged.categoryId).toBe(a.category.id);
  });

  it("aceita como responsável em B a pessoa de A que também é membro de B (multiempresa)", async () => {
    await prisma.membership.create({ data: { companyId: b.company.id, userId: a.user.id, status: "ACTIVE" } });

    const document = await prisma.document.create({
      data: { companyId: b.company.id, title: "Laudo técnico", responsibleUserId: a.user.id },
    });

    expect(document.responsibleUserId).toBe(a.user.id);
  });
});

describe("estrutura organizacional", () => {
  it("rejeita setor da empresa A vinculado a filial da empresa B", async () => {
    await expect(
      prisma.department.create({
        data: { companyId: a.company.id, branchId: b.branch.id, name: "Jurídico" },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("aceita subcategoria com categoria pai do mesmo tenant", async () => {
    const child = await prisma.documentCategory.create({
      data: { companyId: a.company.id, parentId: a.category.id, name: "Alvará sanitário" },
    });

    expect(child.parentId).toBe(a.category.id);
  });

  it("rejeita subcategoria com categoria pai de outro tenant", async () => {
    await expect(
      prisma.documentCategory.create({
        data: { companyId: a.company.id, parentId: b.category.id, name: "Alvará sanitário" },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });
});

describe("RBAC e vínculos", () => {
  it("aceita atribuir perfil do mesmo tenant a um membro", async () => {
    await prisma.userRole.create({
      data: { companyId: a.company.id, userId: a.user.id, roleId: a.role.id },
    });

    expect(await prisma.userRole.count({ where: { companyId: a.company.id } })).toBe(1);
  });

  it("rejeita atribuir a membro da empresa A um perfil da empresa B", async () => {
    await expect(
      prisma.userRole.create({
        data: { companyId: a.company.id, userId: a.user.id, roleId: b.role.id },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejeita atribuir perfil da empresa A a quem não é membro dela", async () => {
    await expect(
      prisma.userRole.create({
        data: { companyId: a.company.id, userId: b.user.id, roleId: a.role.id },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("rejeita sessão com empresa ativa da qual a pessoa não é membro", async () => {
    const now = Date.now();

    await expect(
      prisma.session.create({
        data: {
          id: sha256Hex("token-de-teste"),
          userId: a.user.id,
          activeCompanyId: b.company.id,
          expiresAt: new Date(now + 60_000),
          absoluteExpiresAt: new Date(now + 120_000),
        },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });
});

describe("auditoria", () => {
  it("rejeita evento da empresa A atribuído a quem não é membro dela", async () => {
    await expect(
      prisma.auditLog.create({
        data: { companyId: a.company.id, actorUserId: b.user.id, action: "document.created" },
      }),
    ).rejects.toMatchObject(FOREIGN_KEY_VIOLATION);
  });

  it("aceita evento sem empresa atribuído a qualquer pessoa existente (ex.: login)", async () => {
    const event = await prisma.auditLog.create({ data: { actorUserId: b.user.id, action: "auth.login_succeeded" } });

    expect(event.companyId).toBeNull();
  });
});
