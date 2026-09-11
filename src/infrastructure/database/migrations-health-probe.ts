import { readdir } from "node:fs/promises";
import path from "node:path";
import type { HealthProbe } from "@/application/ports/health-probe";
import type { PrismaClient } from "@/generated/prisma/client";

export interface AppliedMigration {
  readonly migration_name: string;
  readonly finished_at: Date | null;
  readonly rolled_back_at: Date | null;
}

export interface MigrationState {
  /** Migrações presentes no código que não foram aplicadas com sucesso. */
  readonly pending: readonly string[];
  /** Migrações iniciadas que falharam e não foram marcadas como revertidas. */
  readonly failed: readonly string[];
}

export function compareMigrations(
  local: readonly string[],
  applied: readonly AppliedMigration[],
): MigrationState {
  const succeeded = new Set(
    applied
      .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
      .map((row) => row.migration_name),
  );

  return {
    pending: local.filter((name) => !succeeded.has(name)),
    failed: applied
      .filter((row) => row.finished_at === null && row.rolled_back_at === null)
      .map((row) => row.migration_name),
  };
}

export async function listLocalMigrations(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Fica "down" quando o banco não está no schema esperado pelo código:
 * migração pendente, migração com falha ou tabela de migrações inexistente.
 */
export function createMigrationsHealthProbe(
  prisma: PrismaClient,
  migrationsDir: string = path.join(process.cwd(), "prisma", "migrations"),
): HealthProbe {
  return {
    name: "migrations",
    async check() {
      const [local, applied] = await Promise.all([
        listLocalMigrations(migrationsDir),
        prisma.$queryRaw<AppliedMigration[]>`
          SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
        `,
      ]);

      if (local.length === 0) {
        throw new Error("nenhuma migração encontrada no código");
      }

      const { pending, failed } = compareMigrations(local, applied);
      if (pending.length > 0 || failed.length > 0) {
        throw new Error(`migrações pendentes: ${pending.length}; com falha: ${failed.length}`);
      }
    },
  };
}
