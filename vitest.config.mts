import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` lança erro fora do runtime de servidor do Next.js;
      // nos testes (Node) é substituído por um módulo vazio.
      "server-only": fromRoot("./tests/support/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/support/global-setup.ts"],
          // Compartilham o mesmo banco de teste: execução serial.
          fileParallelism: false,
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
