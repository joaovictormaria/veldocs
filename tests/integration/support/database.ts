import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/database/prisma-client";
import { getTestDatabaseUrl } from "./test-database-url";

export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(getTestDatabaseUrl());
}

/** Limpa todas as tabelas da aplicação (inclusive audit_logs: TRUNCATE não dispara o trigger de UPDATE/DELETE). */
export async function truncateAllTables(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;

  const tables = rows.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

/** Cria um tenant completo (empresa, filial, setor, usuário, perfil e categoria). */
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
    data: {
      companyId: company.id,
      email: `usuario-${label}-${suffix}@example.com`.toLowerCase(),
      name: `Usuário ${label}`,
    },
  });
  const role = await prisma.role.create({
    data: { companyId: company.id, key: "ADMIN", name: "Administrador", isSystem: true },
  });
  const category = await prisma.documentCategory.create({
    data: { companyId: company.id, name: "Licenças e alvarás" },
  });

  return { company, branch, department, user, role, category };
}
