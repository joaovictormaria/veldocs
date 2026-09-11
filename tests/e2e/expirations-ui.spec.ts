import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { ORIGIN } from "./support/session";

const PASSWORD = "uma frase longa e secreta";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

const emDias = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

async function signIn(page: Page, companyName: string) {
  const email = `venc-${randomUUID().slice(0, 10)}@example.com`;
  const signup = await page.request.post("/api/auth/signup", {
    data: { name: "Pessoa dos Vencimentos", email, password: PASSWORD, companyName },
    headers: { Origin: ORIGIN },
  });
  expect(signup.status()).toBe(201);

  const start = await page.request.post("/api/auth/mfa/enroll", { headers: { Origin: ORIGIN } });
  const { secret } = (await start.json()) as { secret: string };
  await page.request.post("/api/auth/mfa/enroll/confirm", {
    data: { code: totpCode(secret, totpStep(new Date())) },
    headers: { Origin: ORIGIN },
  });
}

const criarDocumento = async (page: Page, title: string, expirationDate: string | null) => {
  const response = await page.request.post("/api/documents", {
    data: { title, expirationDate },
    headers: { Origin: ORIGIN },
  });
  expect(response.status()).toBe(201);
};

test("painel de vencimentos mostra a situação e renova pela tela", async ({ page }) => {
  await signIn(page, "Empresa Painel Vencimentos E2E");
  const trial = await page.request.post("/api/builder/trial", {
    data: { modules: ["vencimentos"] },
    headers: { Origin: ORIGIN },
  });
  expect(trial.status()).toBe(201);

  await criarDocumento(page, "Alvará vencido", emDias(-10));
  await criarDocumento(page, "Certidão vencendo", emDias(5));
  await criarDocumento(page, "Apólice válida", emDias(200));

  await page.goto("/vencimentos");
  await expect(page.getByRole("heading", { name: "Vencimentos" })).toBeVisible();

  const resumo = page.getByTestId("resumo-vencimentos");
  await expect(resumo).toContainText("Vencidos");
  await expect(resumo).toContainText("Em dia");

  const lista = page.getByTestId("lista-vencimentos");
  await expect(lista).toContainText("Alvará vencido");
  await expect(lista).toContainText("venceu há 10 dias");
  await expect(lista).toContainText("Certidão vencendo");
  await expect(lista).toContainText("vence em 5 dias");
  await expect(lista).not.toContainText("Apólice válida");

  // Renovar tira o documento da lista de atenção.
  await lista.getByRole("button", { name: "Renovar" }).first().click();
  const formulario = page.getByTestId("form-renovacao");
  await expect(formulario).toContainText("Alvará vencido");
  await formulario.getByLabel("Nova emissão").fill(emDias(0));
  await formulario.getByLabel("Nova validade").fill(emDias(365));
  await page.getByRole("button", { name: "Salvar renovação" }).click();

  await expect(lista).not.toContainText("Alvará vencido");
  await expect(lista).toContainText("Certidão vencendo");

  // A situação também aparece na lista de documentos, com filtro por situação.
  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page.getByTestId("lista-documentos")).toContainText("Vence em breve");

  await page.getByLabel("Situação").selectOption("VALID");
  await expect(page.getByTestId("resumo-pagina")).toHaveText("1-2 de 2");
  await expect(page.getByTestId("lista-documentos")).not.toContainText("Certidão vencendo");
});

test("sem o módulo contratado, a tela explica o que ele faz", async ({ page }) => {
  await signIn(page, "Empresa Sem Vencimentos E2E");

  await page.goto("/documentos");
  const navegacao = page.getByRole("navigation", { name: "Seções" });
  await expect(navegacao.getByRole("link", { name: "Vencimentos" })).toHaveCount(0);
  // Sem o módulo, a lista não oferece filtro por situação.
  await expect(page.getByLabel("Situação")).toHaveCount(0);

  await page.goto("/vencimentos");
  await expect(page.getByRole("heading", { name: "Nenhum documento vence sem aviso" })).toBeVisible();
  await page.getByRole("link", { name: "Ver módulos e preços" }).click();
  await expect(page.getByRole("heading", { name: "Monte o VELDOCS da sua empresa" })).toBeVisible();
});
