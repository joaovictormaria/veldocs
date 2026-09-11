import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkHealth } from "@/application/system/check-health";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseHealthProbe } from "@/infrastructure/database/database-health-probe";
import {
  createMigrationsHealthProbe,
  listLocalMigrations,
} from "@/infrastructure/database/migrations-health-probe";
import { createPrismaClient } from "@/infrastructure/database/prisma-client";
import { createTestPrismaClient } from "../support/database";

const APPLICATION_TABLES = [
  "audit_logs",
  "branches",
  "companies",
  "company_invitations",
  "company_modules",
  "departments",
  "document_categories",
  "document_tags",
  "documents",
  "kit_modules",
  "kit_prices",
  "kits",
  "memberships",
  "module_dependencies",
  "module_prices",
  "modules",
  "permissions",
  "rate_limit_buckets",
  "role_permissions",
  "roles",
  "sessions",
  "subscriptions",
  "tags",
  "user_recovery_codes",
  "user_roles",
  "user_totp_credentials",
  "users",
].sort();

/**
 * Tabelas de dados empresariais: company_id obrigatório.
 * O catálogo (`modules`, `module_dependencies`, `module_prices`) é global.
 */
const TENANT_SCOPED_TABLES = [
  "branches",
  "company_invitations",
  "company_modules",
  "departments",
  "document_categories",
  "document_tags",
  "documents",
  "memberships",
  "roles",
  "subscriptions",
  "tags",
  "user_roles",
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

  it("aplicou as migrações com sucesso", async () => {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;

    expect(rows.map((row) => row.migration_name)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/_init_base_entities$/),
        expect.stringMatching(/_identity_memberships_sessions$/),
      ]),
    );
  });

  it("criou exatamente as tabelas da aplicação", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    `;

    // Ordenado no teste: a ordenação do banco depende da configuração de idioma.
    expect(rows.map((row) => row.table_name).sort()).toEqual(APPLICATION_TABLES);
  });

  it("toda tabela de dados empresariais possui company_id obrigatório e users não pertence a empresa", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; is_nullable: string }>>`
      SELECT table_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'company_id'
    `;
    const nullableByTable = Object.fromEntries(rows.map((row) => [row.table_name, row.is_nullable]));

    for (const table of TENANT_SCOPED_TABLES) {
      expect(nullableByTable[table], table).toBe("NO");
    }
    // Auditoria aceita eventos sem empresa (ex.: login); a pessoa é global (DEC-009).
    expect(nullableByTable.audit_logs).toBe("YES");
    expect(nullableByTable.users).toBeUndefined();
  });
});

describe("health probe de migrações", () => {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

  it("reporta up quando todas as migrações do código estão aplicadas", async () => {
    await expect(checkHealth([createMigrationsHealthProbe(prisma, migrationsDir)])).resolves.toEqual({
      status: "ok",
      checks: { migrations: "up" },
    });
  });

  it("reporta down quando existe migração no código ainda não aplicada", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "veldocs-migrations-"));

    try {
      for (const name of await listLocalMigrations(migrationsDir)) {
        await mkdir(path.join(dir, name));
      }
      await mkdir(path.join(dir, "29991231235959_future_migration"));

      await expect(checkHealth([createMigrationsHealthProbe(prisma, dir)])).resolves.toEqual({
        status: "degraded",
        checks: { migrations: "down" },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reporta down quando o diretório de migrações não existe", async () => {
    const missing = path.join(tmpdir(), "veldocs-migrations-inexistente");

    await expect(checkHealth([createMigrationsHealthProbe(prisma, missing)])).resolves.toEqual({
      status: "degraded",
      checks: { migrations: "down" },
    });
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
