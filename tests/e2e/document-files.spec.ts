import { randomInt, randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, type Page, test } from "@playwright/test";
import { totpCode, totpStep } from "../../src/infrastructure/security/totp";
import { headers, ORIGIN, signupWithMfa } from "./support/session";

interface UploadRequest {
  file: { id: string; status: string };
  upload: { url: string; fields: Record<string, string> };
}

const pdf = (text: string) => Buffer.from(`%PDF-1.7\n% ${text}\n%%EOF\n`);

/** Envia como o navegador: campos assinados e o arquivo por último. */
async function postToStorage(upload: UploadRequest["upload"], content: Buffer) {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  form.append("file", new Blob([new Uint8Array(content)]), "arquivo");
  return fetch(upload.url, { method: "POST", body: form });
}

test("arquivo pela API: pedido, envio direto ao bucket, conferência e download", async ({ request }) => {
  await signupWithMfa(request, "Empresa Arquivos API E2E");
  const document = (await (await request.post("/api/documents", { data: { title: "Alvará" }, headers: headers() })).json())
    .document as { id: string };

  const content = pdf("alvara");
  const pedido = await request.post(`/api/documents/${document.id}/files`, {
    data: { fileName: "alvará.pdf", contentType: "application/pdf", sizeBytes: content.length },
    headers: headers(),
  });
  expect(pedido.status()).toBe(201);
  const { file, upload } = (await pedido.json()) as UploadRequest;
  expect(file.status).toBe("PENDING");
  expect(JSON.stringify(file)).not.toContain("companies/");

  expect((await postToStorage(upload, content)).status).toBeLessThan(300);

  const concluido = await request.post(`/api/documents/${document.id}/files/${file.id}/complete`, { headers: headers() });
  expect(concluido.status()).toBe(200);
  expect((await concluido.json()).file).toMatchObject({ status: "AVAILABLE", fileName: "alvará.pdf" });

  const lista = await request.get(`/api/documents/${document.id}/files`);
  expect(((await lista.json()).files as Array<{ id: string }>).map((item) => item.id)).toEqual([file.id]);

  const download = await request.get(`/api/documents/${document.id}/files/${file.id}/download`, { maxRedirects: 0 });
  expect(download.status()).toBe(302);
  const location = download.headers().location as string;
  expect(location).toContain("X-Amz-Signature");
  const baixado = await fetch(location);
  expect(Buffer.from(await baixado.arrayBuffer())).toEqual(content);
});

test("arquivo disfarçado é recusado; tipo e tamanho fora da política nem recebem URL", async ({ request }) => {
  await signupWithMfa(request, "Empresa Arquivos Recusa E2E");
  const document = (await (await request.post("/api/documents", { data: { title: "Certidão" }, headers: headers() })).json())
    .document as { id: string };

  const zip = await request.post(`/api/documents/${document.id}/files`, {
    data: { fileName: "pacote.zip", contentType: "application/zip", sizeBytes: 100 },
    headers: headers(),
  });
  expect(zip.status()).toBe(400);

  const grande = await request.post(`/api/documents/${document.id}/files`, {
    data: { fileName: "enorme.pdf", contentType: "application/pdf", sizeBytes: 26 * 1024 * 1024 },
    headers: headers(),
  });
  expect(grande.status()).toBe(400);

  const disfarcado = Buffer.from("MZ executável fingindo ser PDF");
  const pedido = (await (
    await request.post(`/api/documents/${document.id}/files`, {
      data: { fileName: "certidao.pdf", contentType: "application/pdf", sizeBytes: disfarcado.length },
      headers: headers(),
    })
  ).json()) as UploadRequest;
  await postToStorage(pedido.upload, disfarcado);

  const concluido = await request.post(`/api/documents/${document.id}/files/${pedido.file.id}/complete`, { headers: headers() });
  expect(concluido.status()).toBe(400);
  expect((await concluido.json()).issues).toEqual([{ field: "file", message: "o conteúdo não é um arquivo PDF válido" }]);

  const lista = await request.get(`/api/documents/${document.id}/files`);
  expect((await lista.json()).files).toEqual([]);
});

test("arquivos exigem sessão, mesma origem e a própria empresa", async ({ request, baseURL }) => {
  const falso = randomUUID();
  expect((await request.get(`/api/documents/${falso}/files`)).status()).toBe(401);
  expect((await request.get(`/api/documents/${falso}/files/${falso}/download`, { maxRedirects: 0 })).status()).toBe(401);

  await signupWithMfa(request, "Empresa Arquivos Dona E2E");
  const document = (await (await request.post("/api/documents", { data: { title: "Contrato" }, headers: headers() })).json())
    .document as { id: string };
  const content = pdf("contrato");
  const { file, upload } = (await (
    await request.post(`/api/documents/${document.id}/files`, {
      data: { fileName: "contrato.pdf", contentType: "application/pdf", sizeBytes: content.length },
      headers: headers(),
    })
  ).json()) as UploadRequest;
  await postToStorage(upload, content);
  await request.post(`/api/documents/${document.id}/files/${file.id}/complete`, { headers: headers() });

  const semOrigem = await request.post(`/api/documents/${document.id}/files`, {
    data: { fileName: "x.pdf", contentType: "application/pdf", sizeBytes: 10 },
  });
  expect(semOrigem.status()).toBe(403);

  const intruso = await playwrightRequest.newContext({ baseURL });
  try {
    await signupWithMfa(intruso, "Empresa Arquivos Intrusa E2E");
    expect((await intruso.get(`/api/documents/${document.id}/files`)).status()).toBe(404);
    expect(
      (await intruso.get(`/api/documents/${document.id}/files/${file.id}/download`, { maxRedirects: 0 })).status(),
    ).toBe(404);
    expect((await intruso.delete(`/api/documents/${document.id}/files/${file.id}`, { headers: headers() })).status()).toBe(404);
  } finally {
    await intruso.dispose();
  }
});

test.describe("arquivos pela tela", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` } });

  async function signIn(page: Page) {
    const email = `arquivos-${randomUUID().slice(0, 10)}@example.com`;
    await page.request.post("/api/auth/signup", {
      data: { name: "Pessoa dos Arquivos", email, password: "uma frase longa e secreta", companyName: "Empresa Arquivos Tela E2E" },
      headers: { Origin: ORIGIN },
    });
    const start = await page.request.post("/api/auth/mfa/enroll", { headers: { Origin: ORIGIN } });
    const { secret } = (await start.json()) as { secret: string };
    await page.request.post("/api/auth/mfa/enroll/confirm", {
      data: { code: totpCode(secret, totpStep(new Date())) },
      headers: { Origin: ORIGIN },
    });
  }

  test("anexa pelo formulário, baixa e remove", async ({ page }) => {
    await signIn(page);
    await page.request.post("/api/documents", { data: { title: "Alvará de Funcionamento" }, headers: { Origin: ORIGIN } });

    await page.goto("/documentos");
    await page.getByRole("button", { name: "Editar" }).click();

    const arquivos = page.getByTestId("arquivos-documento");
    await expect(arquivos).toContainText("Nenhum arquivo anexado.");

    await page.setInputFiles("#arquivo", {
      name: "alvara-2026.pdf",
      mimeType: "application/pdf",
      buffer: pdf("alvara pela tela"),
    });
    await expect(page.getByTestId("lista-arquivos")).toContainText("alvara-2026.pdf");
    await expect(page.getByTestId("lista-arquivos")).toContainText("enviado por Pessoa dos Arquivos");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("lista-arquivos").getByRole("link", { name: "Baixar" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("alvara-2026.pdf");

    await page.getByTestId("lista-arquivos").getByRole("button", { name: "Remover" }).click();
    await page.getByRole("button", { name: "Confirmar remoção" }).click();
    await expect(arquivos).toContainText("Nenhum arquivo anexado.");
  });

  test("arquivo com conteúdo inválido mostra o motivo da recusa", async ({ page }) => {
    await signIn(page);
    await page.request.post("/api/documents", { data: { title: "Certidão" }, headers: { Origin: ORIGIN } });

    await page.goto("/documentos");
    await page.getByRole("button", { name: "Editar" }).click();
    await page.setInputFiles("#arquivo", {
      name: "certidao.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("isto não é um PDF"),
    });

    await expect(page.getByTestId("arquivos-documento").getByRole("alert")).toContainText("o conteúdo não é um arquivo PDF válido");
  });
});
