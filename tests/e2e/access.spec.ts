import { randomInt, randomUUID } from "node:crypto";
import { type APIRequestContext, expect, request as playwrightRequest, test } from "@playwright/test";

const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

/** IP aleatório por requisição: o limite de cadastros por IP persiste no banco entre execuções. */
const headers = () => ({ Origin: ORIGIN, "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}` });

async function signup(api: APIRequestContext, companyName: string) {
  const account = {
    name: "Pessoa E2E",
    email: `acesso-${randomUUID().slice(0, 12)}@example.com`,
    password: "uma frase longa e secreta",
    companyName,
  };
  const response = await api.post("/api/auth/signup", { data: account, headers: headers() });
  expect(response.status()).toBe(201);
  return { account, ...((await response.json()) as { userId: string; companyId: string }) };
}

test("empresa ativa: dados da empresa e membros vêm sempre da sessão", async ({ request }) => {
  const owner = await signup(request, "Empresa Alfa E2E");

  const company = await request.get("/api/company");
  expect(company.status()).toBe(200);
  expect((await company.json()).company).toMatchObject({ id: owner.companyId, name: "Empresa Alfa E2E", status: "ACTIVE" });

  const members = await request.get("/api/company/members");
  expect(members.status()).toBe(200);
  const { members: list } = (await members.json()) as { members: Array<Record<string, unknown>> };
  expect(list).toEqual([
    expect.objectContaining({ userId: owner.userId, email: owner.account.email, status: "ACTIVE", roleKeys: ["OWNER"] }),
  ]);
  expect(JSON.stringify(list)).not.toMatch(/password|cpf/i);

  const member = await request.get(`/api/company/members/${owner.userId}`);
  expect(member.status()).toBe(200);
});

test("pessoa de outra empresa não acessa membros nem seleciona a empresa alheia", async ({ request, baseURL }) => {
  const alpha = await signup(request, "Empresa Alfa E2E");

  const other = await playwrightRequest.newContext({ baseURL });
  try {
    const beta = await signup(other, "Empresa Beta E2E");

    const foreignMember = await other.get(`/api/company/members/${alpha.userId}`);
    expect(foreignMember.status()).toBe(404);
    expect(await foreignMember.json()).toEqual({ error: "not_found" });

    const foreignCompany = await other.post("/api/auth/active-company", {
      data: { companyId: alpha.companyId },
      headers: headers(),
    });
    expect(foreignCompany.status()).toBe(404);
    expect((await foreignCompany.json()).error).toBe("company_not_available");

    const ownCompany = await other.get("/api/company");
    expect((await ownCompany.json()).company.id).toBe(beta.companyId);

    const selectOwn = await other.post("/api/auth/active-company", { data: { companyId: beta.companyId }, headers: headers() });
    expect(selectOwn.status()).toBe(200);
    expect(await selectOwn.json()).toEqual({ activeCompanyId: beta.companyId });
  } finally {
    await other.dispose();
  }
});

test("ids inexistentes ou inválidos respondem 404", async ({ request }) => {
  await signup(request, "Empresa Gama E2E");

  for (const id of [randomUUID(), "nao-e-uuid", "..%2F..%2Fetc"]) {
    const response = await request.get(`/api/company/members/${id}`);
    expect(response.status(), id).toBe(404);
  }
});

test("sem sessão responde 401 e a troca de empresa exige mesma origem", async ({ request }) => {
  for (const path of ["/api/company", "/api/company/members", `/api/company/members/${randomUUID()}`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect((await response.json()).error).toBe("unauthenticated");
  }

  const withoutOrigin = await request.post("/api/auth/active-company", { data: { companyId: randomUUID() } });
  expect(withoutOrigin.status()).toBe(403);

  const unauthenticated = await request.post("/api/auth/active-company", {
    data: { companyId: randomUUID() },
    headers: headers(),
  });
  expect(unauthenticated.status()).toBe(401);
});
