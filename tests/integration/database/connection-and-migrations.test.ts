import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkHealth } from "@/application/system/check-health";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseHealthProbe } from "@/infrastructure/database/database-health-probe";
import { createPrismaClient } from "@/infrastructure/database/prisma-client";
import { createTestPrismaClient } from "../support/database";

const BASE_TABLES = [
  "audit_logs",
  "branches",
  "companies",
  "departments",
  "document_categories",
  "documents",
  "permissions",
  "role_permissions",
  "roles",
  "user_roles",
  "users",
];

/** Tabelas de dados empresariais: company_id obrigatório. */
const TENANT_SCOPED_TABLES = [
  "branches",
  "departments",
  "document_categories",
  "documents",
  "roles",
  "user_roles",
  "users",
];

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("conexão e migrações", () => {
  it("conecta ao PostgreSQL", async () => {
    const [row] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() AS version`;

    expect(row?.version).toMatch(/^PostgreSQL \d+/);
  });

  it("aplicou a migração inicial com sucesso", async () => {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;

    expect(rows.map((row) => row.migration_name)).toEqual(
      expect.arrayContaining([expect.stringMatching(/_init_base_entities$/)]),
    );
  });

  it("criou exatamente as tabelas base", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `;

    expect(rows.map((row) => row.table_name)).toEqual(BASE_TABLES);
  });

  it("toda tabela de dados empresariais possui company_id obrigatório", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; is_nullable: string }>>`
      SELECT table_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'company_id'
    `;
    const nullableByTable = Object.fromEntries(rows.map((row) => [row.table_name, row.is_nullable]));

    for (const table of TENANT_SCOPED_TABLES) {
      expect(nullableByTable[table], table).toBe("NO");
    }
    // Auditoria aceita eventos sem tenant resolvido (ex.: falha de login).
    expect(nullableByTable.audit_logs).toBe("YES");
  });
});

describe("health probe do banco", () => {
  it("reporta banco disponível", async () => {
    await expect(checkHealth([createDatabaseHealthProbe(prisma)])).resolves.toEqual({
      status: "ok",
      checks: { database: "up" },
    });
  });

  it("reporta banco indisponível sem expor detalhes", async () => {
    const unreachable = createPrismaClient("postgresql://nobody:nothing@127.0.0.1:1/unreachable_test");

    try {
      await expect(
        checkHealth([createDatabaseHealthProbe(unreachable)], { timeoutMs: 5_000 }),
      ).resolves.toEqual({ status: "degraded", checks: { database: "down" } });
    } finally {
      await unreachable.$disconnect();
    }
  });
});
