import { expect, test } from "@playwright/test";

test("página inicial apresenta a identidade do VELDOCS", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("VELDOCS");
  await expect(page.getByRole("heading", { level: 1, name: "VELDOCS" })).toBeVisible();
  await expect(page.getByText("Zero surpresa documental.")).toBeVisible();
});

test("health check confirma aplicação, banco e migrações", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    checks: { database: "up", migrations: "up" },
  });
});

test("não expõe o header X-Powered-By", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
