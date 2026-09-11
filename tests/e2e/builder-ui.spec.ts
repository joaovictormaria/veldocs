import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { ORIGIN } from "./support/session";

const PASSWORD = "uma frase longa e secreta";

// O limite de cadastros é por IP e fica no banco entre execuções.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

/** Conta + segundo fator pela API, com os cookies da própria página. */
async function signupWithMfaForPage(page: Page, companyName: string) {
  const email = `tela-${randomUUID().slice(0, 10)}@example.com`;
  const signup = await page.request.post("/api/auth/signup", {
    data: { name: "Pessoa da Tela", email, password: PASSWORD, companyName },
    headers: { Origin: ORIGIN },
  });
  expect(signup.status()).toBe(201);

  const start = await page.request.post("/api/auth/mfa/enroll", { headers: { Origin: ORIGIN } });
  const { secret } = (await start.json()) as { secret: string };
  const confirm = await page.request.post("/api/auth/mfa/enroll/confirm", {
    data: { code: totpCode(secret, totpStep(new Date())) },
    headers: { Origin: ORIGIN },
  });
  const { recoveryCodes } = (await confirm.json()) as { recoveryCodes: string[] };
  return { email, recoveryCodes };
}

test("cadastro pela tela, segundo fator e início do trial no Builder", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Pessoa da Tela");
  await page.getByLabel("E-mail", { exact: true }).fill(`tela-${randomUUID().slice(0, 10)}@example.com`);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Nome da empresa").fill("Empresa Tela E2E");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/seguranca$/);
  await page.getByRole("button", { name: "Gerar chave do aplicativo" }).click();
  const secret = ((await page.getByTestId("mfa-secret").textContent()) ?? "").replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel("Código de 6 dígitos").fill(totpCode(secret, totpStep(new Date())));
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByTestId("recovery-codes").getByRole("listitem")).toHaveCount(10);
  await page.getByRole("button", { name: "Guardei meus códigos, continuar" }).click();

  await expect(page).toHaveURL(/\/builder$/);
  await page.getByTestId("kit-gestao").click();
  await page.getByLabel(/^Contratos/).check();
  await expect(page.getByTestId("builder-total")).toHaveText(/R\$\s169,80/);

  await page.getByRole("button", { name: "Começar 14 dias grátis" }).click();
  const summary = page.getByTestId("subscription-summary");
  await expect(summary).toContainText("Em teste grátis");
  await expect(summary).toContainText("Kit Gestão");
  await expect(summary).toContainText("14 dias restantes");
  await expect(summary).toContainText(/169,80/);
});

test("a tela sugere o kit quando a escolha avulsa sai mais cara", async ({ page }) => {
  await signupWithMfaForPage(page, "Empresa Sugestão Tela E2E");
  await page.goto("/builder");

  for (const name of ["Controle de vencimentos", "Funcionários", "Fornecedores", "Solicitações"]) {
    await page.getByLabel(new RegExp(`^${name}`)).check();
  }
  await expect(page.getByTestId("builder-total")).toHaveText(/159,50/);

  const suggestion = page.getByTestId("builder-suggestion");
  await expect(suggestion).toContainText("Gestão");
  await expect(suggestion).toContainText(/29,60/);
  await suggestion.getByRole("button", { name: "Usar o kit Gestão" }).click();

  await expect(page.getByTestId("kit-gestao")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("builder-total")).toHaveText(/129,90/);
  await expect(page.getByTestId("builder-suggestion")).toHaveCount(0);
});

test("login pela tela pede o segundo fator e aceita código de recuperação", async ({ page }) => {
  const { email, recoveryCodes } = await signupWithMfaForPage(page, "Empresa Login Tela E2E");
  await page.request.post("/api/auth/logout", { headers: { Origin: ORIGIN } });

  await page.goto("/entrar");
  await page.getByLabel("E-mail ou CPF").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/seguranca$/);
  await page.getByLabel("Código do aplicativo ou de recuperação").fill(recoveryCodes[0] as string);
  await page.getByRole("button", { name: "Verificar" }).click();

  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole("heading", { name: "Monte o VELDOCS da sua empresa" })).toBeVisible();
});

test("convite pela tela: o convidado se cadastra e entra na empresa", async ({ page, browser }) => {
  await signupWithMfaForPage(page, "Empresa Convite Tela E2E");
  const created = await page.request.post("/api/company/invitations", {
    data: { email: `convidado-tela-${randomUUID().slice(0, 8)}@example.com`, roleKey: "COLABORADOR" },
    headers: { Origin: ORIGIN },
  });
  expect(created.status()).toBe(201);
  const invitePath = new URL(((await created.json()) as { inviteUrl: string }).inviteUrl).pathname;

  const guestContext = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` },
  });
  try {
    const guest = await guestContext.newPage();
    await guest.goto(invitePath);
    await expect(guest.getByRole("heading", { name: "Convite para Empresa Convite Tela E2E" })).toBeVisible();

    await guest.getByLabel("Seu nome").fill("Pessoa Convidada");
    await guest.getByLabel("Crie uma senha").fill(PASSWORD);
    await guest.getByRole("button", { name: "Entrar na empresa" }).click();

    // Colaborador não escolhe módulos: começa pelo painel, não pelo Builder.
    await expect(guest).toHaveURL(/\/painel$/);
    await expect(guest.getByRole("heading", { name: "Olá, Pessoa" })).toBeVisible();

    await guest.goto("/builder");
    await expect(guest.getByText("Somente Proprietário ou Administrador podem escolher os módulos da empresa.")).toBeVisible();

    await guest.goto(invitePath);
    await expect(guest.getByRole("heading", { name: "Convite indisponível" })).toBeVisible();
  } finally {
    await guestContext.close();
  }
});

test("telas protegidas levam ao login guardando o destino, e destino externo é ignorado", async ({ page }) => {
  // O Next.js redireciona com a barra sem codificar (`next=/builder`).
  await page.goto("/builder");
  await expect(page).toHaveURL(/\/entrar\?next=(?:%2F|\/)builder$/);

  await page.goto("/seguranca");
  await expect(page).toHaveURL(/\/entrar\?next=(?:%2F|\/)seguranca$/);

  await page.goto("/entrar?next=https://evil.example");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});
