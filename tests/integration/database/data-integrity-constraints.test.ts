import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";

type Tenant = Awaited<ReturnType<typeof createTenantFixture>>;

const UNIQUE_VIOLATION = { code: "P2002" };

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

describe("audit_logs append-only", () => {
  const createEvent = () =>
    prisma.auditLog.create({
      data: {
        companyId: a.company.id,
        actorUserId: a.user.id,
        action: "document.created",
        entityType: "Document",
        entityId: "00000000-0000-0000-0000-000000000001",
        metadata: { source: "integration-test" },
      },
    });

  it("permite inserir eventos", async () => {
    const event = await createEvent();

    expect(event.action).toBe("document.created");
  });

  it("bloqueia alteração de eventos", async () => {
    const event = await createEvent();

    await expect(
      prisma.auditLog.update({ where: { id: event.id }, data: { action: "document.deleted" } }),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE id = ${event.id}::uuid`,
    ).rejects.toThrow(/append-only/);

    const stored = await prisma.auditLog.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.action).toBe("document.created");
  });

  it("bloqueia exclusão de eventos", async () => {
    const event = await createEvent();

    await expect(prisma.auditLog.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);

    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("aceita evento sem tenant resolvido", async () => {
    const event = await prisma.auditLog.create({ data: { action: "auth.login_failed" } });

    expect(event.companyId).toBeNull();
  });
});

describe("usuários", () => {
  it("exige e-mail normalizado em minúsculas", async () => {
    await expect(
      prisma.user.create({
        data: { companyId: a.company.id, email: "Maria.Silva@Example.com", name: "Maria" },
      }),
    ).rejects.toThrow(/users_email_lowercase_chk/);
  });

  it("não permite o mesmo e-mail em duas empresas (DEC-005)", async () => {
    await expect(
      prisma.user.create({ data: { companyId: b.company.id, email: a.user.email, name: "Duplicado" } }),
    ).rejects.toMatchObject(UNIQUE_VIOLATION);
  });
});

describe("unicidade por tenant", () => {
  it("permite a mesma chave de perfil em empresas diferentes", async () => {
    expect(await prisma.role.count({ where: { key: "ADMIN" } })).toBe(2);
  });

  it("não permite chave de perfil duplicada na mesma empresa", async () => {
    await expect(
      prisma.role.create({ data: { companyId: a.company.id, key: "ADMIN", name: "Outro admin" } }),
    ).rejects.toMatchObject(UNIQUE_VIOLATION);
  });

  it("não permite código de filial duplicado na mesma empresa", async () => {
    await expect(
      prisma.branch.create({ data: { companyId: a.company.id, name: "Filial 2", code: "MTZ" } }),
    ).rejects.toMatchObject(UNIQUE_VIOLATION);
  });

  it("não permite slug de empresa duplicado", async () => {
    await expect(
      prisma.company.create({ data: { name: "Clone", slug: a.company.slug } }),
    ).rejects.toMatchObject(UNIQUE_VIOLATION);
  });
});

describe("permissões", () => {
  it("aceita chave no formato recurso.acao e vincula a perfil", async () => {
    const permission = await prisma.permission.create({ data: { key: "documents.read" } });
    await prisma.rolePermission.create({ data: { roleId: a.role.id, permissionId: permission.id } });

    expect(await prisma.rolePermission.count({ where: { roleId: a.role.id } })).toBe(1);
  });

  it.each(["Documents.Read", "documents", "documents read"])("rejeita chave inválida %j", async (key) => {
    await expect(prisma.permission.create({ data: { key } })).rejects.toThrow(/permissions_key_format_chk/);
  });

  it("não permite chave de permissão duplicada", async () => {
    await prisma.permission.create({ data: { key: "documents.read" } });

    await expect(prisma.permission.create({ data: { key: "documents.read" } })).rejects.toMatchObject(
      UNIQUE_VIOLATION,
    );
  });
});

describe("integridade referencial", () => {
  it("impede excluir empresa que possui dados vinculados", async () => {
    await expect(prisma.company.delete({ where: { id: a.company.id } })).rejects.toThrow();

    expect(await prisma.company.count({ where: { id: a.company.id } })).toBe(1);
  });
});
