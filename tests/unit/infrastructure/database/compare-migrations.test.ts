import { describe, expect, it } from "vitest";
import {
  compareMigrations,
  type AppliedMigration,
} from "@/infrastructure/database/migrations-health-probe";

const applied = (name: string): AppliedMigration => ({
  migration_name: name,
  finished_at: new Date("2026-09-10T00:00:00Z"),
  rolled_back_at: null,
});

describe("compareMigrations", () => {
  it("não aponta pendências quando todas as migrações foram aplicadas", () => {
    expect(compareMigrations(["001_init", "002_users"], [applied("001_init"), applied("002_users")])).toEqual({
      pending: [],
      failed: [],
    });
  });

  it("aponta migração do código ainda não aplicada no banco", () => {
    expect(compareMigrations(["001_init", "002_users"], [applied("001_init")])).toEqual({
      pending: ["002_users"],
      failed: [],
    });
  });

  it("aponta tudo como pendente em banco nunca migrado", () => {
    expect(compareMigrations(["001_init"], [])).toEqual({ pending: ["001_init"], failed: [] });
  });

  it("aponta migração que falhou e não foi resolvida", () => {
    const failed: AppliedMigration = { migration_name: "002_users", finished_at: null, rolled_back_at: null };

    expect(compareMigrations(["001_init", "002_users"], [applied("001_init"), failed])).toEqual({
      pending: ["002_users"],
      failed: ["002_users"],
    });
  });

  it("considera aplicada a migração revertida e depois reaplicada com sucesso", () => {
    const rolledBack: AppliedMigration = {
      migration_name: "002_users",
      finished_at: null,
      rolled_back_at: new Date("2026-09-10T01:00:00Z"),
    };

    expect(
      compareMigrations(["001_init", "002_users"], [applied("001_init"), rolledBack, applied("002_users")]),
    ).toEqual({ pending: [], failed: [] });
  });

  it("ignora migrações aplicadas que não existem no código", () => {
    expect(compareMigrations(["001_init"], [applied("001_init"), applied("000_legacy")])).toEqual({
      pending: [],
      failed: [],
    });
  });
});
