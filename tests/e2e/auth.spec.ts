import { randomInt, randomUUID } from "node:crypto";
import { type APIRequestContext, expect, request as playwrightRequest, test } from "@playwright/test";
import { formatCpf, generateValidCpf } from "../support/cpf";

const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
const PASSWORD = "uma frase longa e secreta";

/** IP aleatório por teste: o limite de cadastros por IP persiste no banco entre execuções. */
const headers = () => ({ Origin: ORIGIN, "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` });

const newAccount = () => ({
  name: "Pessoa E2E",
  email: `e2e-${randomUUID().slice(0, 12)}@example.com`,
  password: PASSWORD,
  companyName: "Empresa E2E",
});

async function signup(api: APIRequestContext, account = newAccount()) {
  const response = await api.post("/api/auth/signup", { data: account, headers: headers() });
  expect(response.status()).toBe(201);
  return { account, body: (await response.json()) as { userId: string; companyId: string }, response };
}

test("cadastro inicia sessão com cookie HttpOnly e SameSite=Lax", async ({ request }) => {
  const { account, body, response } = await signup(request);

  const setCookie = response.headers()["set-cookie"] ?? "";
  expect(setCookie).toMatch(/^veldocs_session=/);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=Lax/i);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const session = await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toEqual({
    user: { id: body.userId, name: account.name, email: account.email },
    activeCompanyId: body.companyId,
    memberships: [{ companyId: body.companyId, companyName: account.companyName, status: "ACTIVE", roleKeys: ["OWNER"] }],
  });
});

test("login por CPF e logout encerrando a sessão", async ({ request, baseURL }) => {
  const cpf = generateValidCpf();
  const { account } = await signup(request, { ...newAccount(), cpf } as ReturnType<typeof newAccount>);

  const browser = await playwrightRequest.newContext({ baseURL });
  try {
    const login = await browser.post("/api/auth/login", {
      data: { identifier: formatCpf(cpf), password: account.password },
      headers: headers(),
    });
    expect(login.status()).toBe(200);
    expect((await browser.get("/api/auth/session")).status()).toBe(200);

    const logout = await browser.post("/api/auth/logout", { headers: headers() });
    expect(logout.status()).toBe(204);
    expect((await browser.get("/api/auth/session")).status()).toBe(401);
  } finally {
    await browser.dispose();
  }
});

test("credenciais inválidas recebem resposta genérica", async ({ request }) => {
  const { account } = await signup(request);

  const wrongPassword = await request.post("/api/auth/login", {
    data: { identifier: account.email, password: "senha errada qualquer" },
    headers: headers(),
  });
  const unknownAccount = await request.post("/api/auth/login", {
    data: { identifier: `ninguem-${randomUUID()}@example.com`, password: PASSWORD },
    headers: headers(),
  });

  for (const response of [wrongPassword, unknownAccount]) {
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_credentials", message: "E-mail, CPF ou senha incorretos." });
  }
});

test("rotas que alteram estado exigem a mesma origem e corpo JSON", async ({ request }) => {
  const withoutOrigin = await request.post("/api/auth/signup", { data: newAccount() });
  const foreignOrigin = await request.post("/api/auth/signup", {
    data: newAccount(),
    headers: { ...headers(), Origin: "https://evil.example" },
  });
  const notJson = await request.post("/api/auth/login", {
    data: "identifier=a&password=b",
    headers: { ...headers(), "Content-Type": "application/x-www-form-urlencoded" },
  });

  expect(withoutOrigin.status()).toBe(403);
  expect(foreignOrigin.status()).toBe(403);
  expect(notJson.status()).toBe(415);
});

test("sessão atual exige autenticação", async ({ request }) => {
  const response = await request.get("/api/auth/session");

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});
