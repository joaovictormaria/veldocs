import { execSync } from "node:child_process";
import { getTestDatabaseUrl } from "./test-database-url";

/** Aplica as migrações versionadas no banco de testes antes da suíte. */
export default function setup(): void {
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
  });
}
