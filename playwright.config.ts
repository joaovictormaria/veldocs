import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI: servidor de produção (requer `pnpm build` antes). Local: dev server.
    command: isCI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
