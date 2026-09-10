import { loadEnv } from "vite";

/**
 * URL do banco de testes de integração.
 *
 * Proteção: os testes LIMPAM o banco, então só aceitamos bancos cujo nome
 * termina em `_test` — evita apagar o banco de desenvolvimento ou produção por
 * engano.
 */
export function getTestDatabaseUrl(): string {
  const env = loadEnv("test", process.cwd(), "");
  const url = env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("TEST_DATABASE_URL não definida. Configure-a no .env (ver .env.example).");
  }

  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL deve apontar para um banco cujo nome termina em "_test" (recebido: "${databaseName}").`,
    );
  }

  return url;
}
