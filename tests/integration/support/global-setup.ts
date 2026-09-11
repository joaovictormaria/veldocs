import { execSync } from "node:child_process";
import { createPrismaClient } from "@/infrastructure/database/prisma-client";
import { getTestDatabaseUrl } from "./test-database-url";

/**
 * Recria o schema do banco de TESTES (nome obrigatoriamente terminado em
 * `_test`) e aplica todas as migrações versionadas, como num banco novo.
 * Assim uma execução anterior interrompida não afeta a próxima.
 */
export default async function setup(): Promise<void> {
  const url = getTestDatabaseUrl();
  const prisma = createPrismaClient(url);

  try {
    await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await prisma.$disconnect();
  }

  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
