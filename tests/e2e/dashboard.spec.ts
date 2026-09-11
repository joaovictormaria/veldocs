import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { headers, ORIGIN, signupWithMfa } from "./support/session";

const PASSWORD = "uma frase longa e secreta";

const emDias = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

test("painel pela API: cadastro documental, vencimentos com o módulo e atividade", async ({ request }) => {
  expect((await request.get("/api/dashboard")).status()).toBe(401);

  await signupWithMfa(request, "Empresa Painel API E2E");

  const vazio = await request.get("/api/dashboard");
  expect(vazio.status()).toBe(200);
  expect(await vazio.json()).toMatchObject({
    documents: { total: 0 },
    categories: { items: [], others: 0 },
    expirations: null,
  });

  await request.post("/api/builder/trial", { data: { modules: ["vencimentos"] }, headers: headers() });
  await request.post("/api/documents", { data: { title: "Alvará", expirationDate: emDias(-3) }, headers: headers() });
  await request.post("/api/documents", { data: { title: "Manual" }, headers: headers() });

  const painel = await (await request.get("/api/dashboard")).json();
  expect(painel).toMatchObject({
    documents: { total: 2, withoutExpiration: 1, withoutResponsible: 2, createdLast30Days: 2 },
    categories: { items: [{ categoryId: null, count: 2 }], others: 0 },
    expirations: { counts: { expired: 1, withoutExpiration: 1 } },
  });
  // O Proprietário vê a trilha: o início do trial e os documentos criados.
  const acoes = (painel.activity as Array<{ action: string }>).map((event) => event.action);
  expect(acoes).toEqual(expect.arrayContaining(["subscription.trial_started", "document.created"]));
  expect(acoes.some((action) => action.startsWith("auth."))).toBe(false);
});

test.describe("painel pela tela", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

  async function signIn(page: Page, companyName: string) {
    const email = `painel-${randomUUID().slice(0, 10)}@example.com`;
    const signup = await page.request.post("/api/auth/signup", {
      data: { name: "Joana Ribeiro", email, password: PASSWORD, companyName },
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

  const post = (page: Page, path: string, data: unknown) =>
    page.request.post(path, { data, headers: { Origin: ORIGIN } });

  test("entrada: empresa nova vai ao Builder; depois do trial, ao painel", async ({ page }) => {
    await signIn(page, "Empresa Entrada E2E");

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/builder$/);

    expect((await post(page, "/api/builder/trial", { modules: [] })).status()).toBe(201);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/painel$/);
    await expect(page.getByRole("heading", { name: "Olá, Joana" })).toBeVisible();

    const navegacao = page.getByRole("navigation", { name: "Seções" });
    await expect(navegacao.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
  });

  test("números do painel levam à lista já filtrada", async ({ page }) => {
    await signIn(page, "Empresa Painel Tela E2E");
    await post(page, "/api/builder/trial", { modules: ["vencimentos"] });

    const categoria = await post(page, "/api/categories", { name: "Fiscal" });
    const categoryId = ((await categoria.json()) as { category: { id: string } }).category.id;
    await post(page, "/api/documents", { title: "Alvará vencido", expirationDate: emDias(-5), categoryId });
    await post(page, "/api/documents", { title: "Certidão em dia", expirationDate: emDias(200), categoryId });
    await post(page, "/api/documents", { title: "Manual interno" });

    await page.goto("/painel");
    const indicadores = page.getByTestId("indicadores");
    await expect(indicadores).toContainText("Documentos");
    await expect(indicadores).toContainText("Sem responsável");

    const vencimentos = page.getByTestId("bloco-vencimentos");
    await expect(vencimentos).toContainText("Próximos vencimentos");
    await expect(vencimentos).toContainText("Alvará vencido");
    await expect(vencimentos).toContainText("venceu há 5 dias");

    const grafico = page.getByTestId("grafico-categorias");
    await expect(grafico.getByRole("link", { name: "Fiscal: 2 documentos" })).toBeVisible();
    await expect(grafico).toContainText("Sem categoria");

    await expect(page.getByTestId("atividade")).toContainText("iniciou o teste grátis");

    // Vencidos → lista de documentos já filtrada por situação.
    await vencimentos.getByRole("link", { name: /Vencidos/ }).click();
    await expect(page).toHaveURL(/\/documentos\?status=EXPIRED$/);
    await expect(page.getByTestId("resumo-pagina")).toHaveText("1-1 de 1");
    await expect(page.getByLabel("Situação")).toHaveValue("EXPIRED");

    // Categoria no gráfico → lista filtrada pela categoria.
    await page.goto("/painel");
    await page.getByTestId("grafico-categorias").getByRole("link", { name: "Fiscal: 2 documentos" }).click();
    await expect(page).toHaveURL(new RegExp(`/documentos\\?categoryId=${categoryId}$`));
    await expect(page.getByTestId("resumo-pagina")).toHaveText("1-2 de 2");
  });

  test("sem o módulo, o painel sugere o Controle de vencimentos a quem tem documentos com validade", async ({ page }) => {
    await signIn(page, "Empresa Sugestão Módulo E2E");
    await post(page, "/api/builder/trial", { modules: ["contratos"] });
    await post(page, "/api/documents", { title: "Alvará", expirationDate: emDias(40) });

    await page.goto("/painel");
    await expect(page.getByTestId("bloco-vencimentos")).toHaveCount(0);
    const oferta = page.getByTestId("oferta-vencimentos");
    await expect(oferta).toContainText("Você tem 1 documento com validade cadastrada");

    await oferta.getByRole("link", { name: "Conhecer o módulo" }).click();
    await expect(page.getByRole("heading", { name: "Nenhum documento vence sem aviso" })).toBeVisible();

    // Filtro por situação vindo da URL é ignorado sem o módulo.
    await page.goto("/documentos?status=EXPIRED");
    await expect(page.getByTestId("resumo-pagina")).toHaveText("1-1 de 1");
  });
});
