import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { buildAuthServices } from "@/infrastructure/composition/auth-services";
import { createPrismaClient } from "@/infrastructure/database/prisma-client";
import { getTestDatabaseUrl } from "./test-database-url";

/** Chaves de TESTE (não são secrets). */
export const TEST_APPLICATION_KEYS = {
  APP_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
  APP_HMAC_KEY: Buffer.from("fedcba9876543210fedcba9876543210").toString("base64"),
} as const;

export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(getTestDatabaseUrl());
}

export function createTestAuthServices(prisma: PrismaClient, now?: () => Date) {
  return buildAuthServices(prisma, TEST_APPLICATION_KEYS, now);
}

/**
 * Catálogo global povoado pelas próprias migrações. Apagá-lo quebraria o
 * cadastro (toda empresa nova recebe o Core, com FK para `modules`) e deixaria
 * o banco de teste diferente do de produção.
 */
const MIGRATION_SEEDED_TABLES = [
  "_prisma_migrations",
  "modules",
  "module_dependencies",
  "module_prices",
  "kits",
  "kit_modules",
  "kit_prices",
];

/** Limpa as tabelas da aplicação (inclusive audit_logs: TRUNCATE não dispara o trigger de UPDATE/DELETE). */
export async function truncateAllTables(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND NOT (tablename = ANY(${MIGRATION_SEEDED_TABLES}))
  `;
  if (rows.length === 0) return;

  const tables = rows.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Cria um tenant completo: empresa, filial, setor, pessoa com vínculo ativo, perfil e categoria. */
export async function createTenantFixture(prisma: PrismaClient, label: string) {
  const suffix = randomUUID().slice(0, 8);

  const company = await prisma.company.create({
    data: { name: `Empresa ${label}`, slug: `empresa-${label}-${suffix}`.toLowerCase() },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, name: `Matriz ${label}`, code: "MTZ" },
  });
  const department = await prisma.department.create({
    data: { companyId: company.id, branchId: branch.id, name: "Financeiro" },
  });
  const user = await prisma.user.create({
    data: { email: `usuario-${label}-${suffix}@example.com`.toLowerCase(), name: `Usuário ${label}` },
  });
  const membership = await prisma.membership.create({
    data: { companyId: company.id, userId: user.id, status: "ACTIVE" },
  });
  const role = await prisma.role.create({
    data: { companyId: company.id, key: "ADMIN", name: "Administrador", isSystem: true },
  });
  const category = await prisma.documentCategory.create({
    data: { companyId: company.id, name: "Licenças e alvarás" },
  });

  return { company, branch, department, user, membership, role, category };
}
