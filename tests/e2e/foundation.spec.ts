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

test("aplica os headers de segurança na página e nas rotas", async ({ request }) => {
  for (const path of ["/", "/api/health"]) {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers["content-security-policy"], path).toContain("default-src 'self'");
    expect(headers["content-security-policy"], path).toMatch(/script-src [^;]*'nonce-/);
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"], path).toBe("same-origin");
    expect(headers["x-request-id"], path).toBeTruthy();
    // Em HTTP local não se envia HSTS (só em produção, que roda em HTTPS).
    expect(headers["strict-transport-security"], path).toBeUndefined();
  }
});

test("usa um nonce diferente a cada requisição e assina os scripts da página", async ({ request }) => {
  const load = async () => {
    const response = await request.get("/");
    const nonce = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "")?.[1];
    return { nonce, html: await response.text() };
  };

  const first = await load();
  const second = await load();

  expect(first.nonce).toBeTruthy();
  expect(first.nonce).not.toBe(second.nonce);
  // Sem isso, a CSP bloquearia os scripts do Next.js na página.
  expect(first.html).toContain(`nonce="${first.nonce}"`);
});

test("exibe a logo oficial e publica favicon e ícones da marca", async ({ page, request }) => {
  await page.goto("/");

  const logo = page.getByRole("img", { name: "VELDOCS" });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty("complete", true);
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('link[rel="icon"]').first()).toBeAttached();
  await expect(page.locator('link[rel="apple-touch-icon"]')).toBeAttached();

  for (const [path, type] of [
    ["/favicon.ico", "image/x-icon"],
    ["/icon.png", "image/png"],
    ["/apple-icon.png", "image/png"],
    ["/brand/veldocs-logo-light.png", "image/png"],
    ["/brand/veldocs-logo-dark.png", "image/png"],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }
});
