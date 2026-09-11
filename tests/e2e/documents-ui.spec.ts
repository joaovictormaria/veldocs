import { randomInt, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { ORIGIN } from "./support/session";

const PASSWORD = "uma frase longa e secreta";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

/** Conta com segundo fator em dia, pronta para abrir as telas internas. */
async function signIn(page: Page, companyName: string) {
  const email = `docs-${randomUUID().slice(0, 10)}@example.com`;
  const signup = await page.request.post("/api/auth/signup", {
    data: { name: "Pessoa dos Documentos", email, password: PASSWORD, companyName },
    headers: { Origin: ORIGIN },
  });
  expect(signup.status()).toBe(201);

  const start = await page.request.post("/api/auth/mfa/enroll", { headers: { Origin: ORIGIN } });
  const { secret } = (await start.json()) as { secret: string };
  const confirm = await page.request.post("/api/auth/mfa/enroll/confirm", {
    data: { code: totpCode(secret, totpStep(new Date())) },
    headers: { Origin: ORIGIN },
  });
  expect(confirm.status()).toBe(200);
}

/** Rótulos como "Categoria" existem no filtro e no formulário: sempre escopar. */
const documentForm = (page: Page) => page.getByTestId("form-documento");
const categoryForm = (page: Page) => page.getByTestId("form-categoria");

test("categoria e documento pela tela: criar, buscar, editar e excluir", async ({ page }) => {
  await signIn(page, "Empresa Telas Documentos E2E");

  // Categoria primeiro: ela aparece no formulário do documento.
  await page.goto("/categorias");
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await categoryForm(page).getByLabel("Nome").fill("Pessoal");
  await categoryForm(page).getByLabel("Descrição").fill("Documentos da equipe");
  await page.getByRole("button", { name: "Salvar categoria" }).click();

  const categorias = page.getByTestId("lista-categorias");
  await expect(categorias).toContainText("Pessoal");
  await expect(categorias).toContainText("0 documentos");

  // Subcategoria, para conferir o caminho completo.
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await categoryForm(page).getByLabel("Nome").fill("Admissão");
  await categoryForm(page).getByLabel("Categoria superior").selectOption({ label: "Pessoal" });
  await page.getByRole("button", { name: "Salvar categoria" }).click();
  await expect(categorias).toContainText("Admissão");

  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  await expect(page.getByTestId("resumo-pagina")).toHaveText("Nenhum documento encontrado");

  await page.getByRole("button", { name: "Novo documento" }).click();
  const formulario = documentForm(page);
  await formulario.getByLabel("Título").fill("Ficha de Admissão");
  await formulario.getByLabel("Descrição").fill("Documentação do funcionário");
  await formulario.getByLabel("Categoria").selectOption({ label: "Pessoal › Admissão" });
  await formulario.getByLabel("Responsável").selectOption({ label: "Pessoa dos Documentos" });
  await formulario.getByLabel("Validade").fill("2027-02-01");
  await formulario.getByLabel("Etiquetas").fill("Pessoal, Urgente");
  await page.getByRole("button", { name: "Salvar documento" }).click();

  const lista = page.getByTestId("lista-documentos");
  await expect(lista).toContainText("Ficha de Admissão");
  await expect(lista).toContainText("Admissão");
  await expect(lista).toContainText("Urgente");
  await expect(lista).toContainText("Vence em 01/02/2027");
  await expect(lista).toContainText("Pessoa dos Documentos");
  await expect(page.getByTestId("resumo-pagina")).toHaveText("1-1 de 1");

  // Busca sem acento encontra; termo que não existe esvazia a lista.
  await page.getByLabel("Buscar").fill("admissao");
  await expect(page.getByTestId("resumo-pagina")).toHaveText("1-1 de 1");
  await page.getByLabel("Buscar").fill("contrato");
  await expect(page.getByTestId("resumo-pagina")).toHaveText("Nenhum documento encontrado");
  await page.getByLabel("Buscar").fill("");
  await expect(lista).toContainText("Ficha de Admissão");

  await page.getByRole("button", { name: "Editar" }).click();
  await documentForm(page).getByLabel("Título").fill("Ficha de Admissão revisada");
  await page.getByRole("button", { name: "Salvar documento" }).click();
  await expect(lista).toContainText("Ficha de Admissão revisada");

  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByTestId("resumo-pagina")).toHaveText("Nenhum documento encontrado");
});

test("a tela recusa o que a API recusa e explica o motivo", async ({ page }) => {
  await signIn(page, "Empresa Telas Validação E2E");

  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  const formulario = documentForm(page);
  await formulario.getByLabel("Título").fill("A");
  await formulario.getByLabel("Emissão").fill("2026-05-10");
  await formulario.getByLabel("Validade").fill("2026-05-09");
  await page.getByRole("button", { name: "Salvar documento" }).click();

  await expect(formulario).toContainText("informe o título do documento");
  await expect(formulario).toContainText("a validade não pode ser anterior à emissão");

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByTestId("form-documento")).toHaveCount(0);

  // Categoria com documento não pode ser excluída: a tela explica.
  await page.getByRole("link", { name: "Categorias" }).click();
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await categoryForm(page).getByLabel("Nome").fill("Fiscal");
  await page.getByRole("button", { name: "Salvar categoria" }).click();
  await expect(page.getByTestId("lista-categorias")).toContainText("Fiscal");

  await page.getByRole("link", { name: "Documentos" }).click();
  await page.getByRole("button", { name: "Novo documento" }).click();
  await documentForm(page).getByLabel("Título").fill("Certidão negativa");
  await documentForm(page).getByLabel("Categoria").selectOption({ label: "Fiscal" });
  await page.getByRole("button", { name: "Salvar documento" }).click();
  await expect(page.getByTestId("lista-documentos")).toContainText("Certidão negativa");

  await page.getByRole("link", { name: "Categorias" }).click();
  await expect(page.getByTestId("lista-categorias")).toContainText("1 documento");
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  // Escopado ao conteúdo: o anunciador de rota do Next.js também é role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toContainText("ainda tem subcategorias ou documentos");
});

test("telas internas exigem sessão e mostram a navegação", async ({ page }) => {
  for (const path of ["/documentos", "/categorias"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/entrar\\?next=(?:%2F|/)${path.slice(1)}$`));
  }

  await signIn(page, "Empresa Navegação E2E");
  await page.goto("/documentos");

  const navegacao = page.getByRole("navigation", { name: "Seções" });
  await expect(navegacao.getByRole("link", { name: "Documentos" })).toHaveAttribute("aria-current", "page");

  await navegacao.getByRole("link", { name: "Assinatura" }).click();
  await expect(page.getByRole("heading", { name: "Monte o VELDOCS da sua empresa" })).toBeVisible();
});
