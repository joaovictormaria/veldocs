import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { headers, ORIGIN, signupWithMfa } from "./support/session";

const PASSWORD = "uma frase longa e secreta";

interface SubscriptionBody {
  status: string;
  canChangeModules: boolean;
  kit: { key: string; name: string } | null;
  modules: Array<{ key: string }>;
  monthlyTotalCents: number | null;
  trial: { daysRemaining: number } | null;
}

test("troca de módulos pela API: só durante o trial, com o novo valor", async ({ request }) => {
  await signupWithMfa(request, "Empresa Troca API E2E");

  const beforeTrial = await request.put("/api/subscription/modules", { data: { modules: [] }, headers: headers() });
  expect(beforeTrial.status()).toBe(409);
  expect((await beforeTrial.json()).error).toBe("trial_not_started");

  const started = await request.post("/api/builder/trial", {
    data: { kitKey: "gestao", modules: ["contratos"] },
    headers: headers(),
  });
  expect(started.status()).toBe(201);
  expect(((await started.json()) as { subscription: SubscriptionBody }).subscription.canChangeModules).toBe(true);

  const changed = await request.put("/api/subscription/modules", {
    data: { kitKey: "comunicacao", modules: ["vencimentos"] },
    headers: headers(),
  });
  expect(changed.status()).toBe(200);
  const { subscription } = (await changed.json()) as { subscription: SubscriptionBody };
  expect(subscription).toMatchObject({
    status: "TRIAL_ACTIVE",
    kit: { key: "comunicacao" },
    monthlyTotalCents: 13980,
    trial: { daysRemaining: 14 },
  });
  expect(subscription.modules.map((entry) => entry.key)).toEqual([
    "core",
    "vencimentos",
    "solicitacoes",
    "whatsapp",
    "portal-terceiros",
  ]);

  const invalid = await request.put("/api/subscription/modules", {
    data: { modules: ["modulo-inventado"] },
    headers: headers(),
  });
  expect(invalid.status()).toBe(400);

  const withoutOrigin = await request.put("/api/subscription/modules", { data: { modules: [] } });
  expect(withoutOrigin.status()).toBe(403);
});

test.describe("troca de módulos pela tela", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

  async function trialForPage(page: Page) {
    const email = `troca-${randomUUID().slice(0, 10)}@example.com`;
    const signup = await page.request.post("/api/auth/signup", {
      data: { name: "Pessoa da Troca", email, password: PASSWORD, companyName: "Empresa Troca Tela E2E" },
      headers: { Origin: ORIGIN },
    });
    expect(signup.status()).toBe(201);
    const start = await page.request.post("/api/auth/mfa/enroll", { headers: { Origin: ORIGIN } });
    const { secret } = (await start.json()) as { secret: string };
    await page.request.post("/api/auth/mfa/enroll/confirm", {
      data: { code: totpCode(secret, totpStep(new Date())) },
      headers: { Origin: ORIGIN },
    });
    const trial = await page.request.post("/api/builder/trial", {
      data: { kitKey: "gestao", modules: ["contratos"] },
      headers: { Origin: ORIGIN },
    });
    expect(trial.status()).toBe(201);
  }

  test("o resumo reabre o Builder com a escolha atual e salva a nova", async ({ page }) => {
    await trialForPage(page);
    await page.goto("/builder");

    const summary = page.getByTestId("subscription-summary");
    await expect(summary).toContainText("Kit Gestão");
    await summary.getByRole("button", { name: "Alterar módulos" }).click();

    await expect(page.getByRole("heading", { name: "Alterar módulos do teste grátis" })).toBeVisible();
    await expect(page.getByTestId("kit-gestao")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(/^Contratos/)).toBeChecked();
    await expect(page.getByTestId("builder-total")).toHaveText(/169,80/);

    await page.getByTestId("kit-comunicacao").click();
    await expect(page.getByTestId("builder-total")).toHaveText(/159,80/);
    await page.getByLabel(/^Contratos/).uncheck();
    await page.getByLabel(/^Controle de vencimentos/).check();
    await expect(page.getByTestId("builder-total")).toHaveText(/139,80/);

    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(summary).toContainText("Kit Comunicação");
    await expect(summary).toContainText(/139,80/);
    await expect(summary).toContainText("14 dias restantes");
    await expect(summary).not.toContainText("Contratos");
  });

  test("cancelar volta ao resumo sem alterar nada", async ({ page }) => {
    await trialForPage(page);
    await page.goto("/builder");

    await page.getByRole("button", { name: "Alterar módulos" }).click();
    await page.getByTestId("kit-comunicacao").click();
    await page.getByRole("button", { name: "Cancelar" }).click();

    const summary = page.getByTestId("subscription-summary");
    await expect(summary).toContainText("Kit Gestão");
    await expect(summary).toContainText(/169,80/);

    await page.reload();
    await expect(page.getByTestId("subscription-summary")).toContainText("Kit Gestão");
  });
});
