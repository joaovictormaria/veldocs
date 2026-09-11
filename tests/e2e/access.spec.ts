import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { enrollMfa, headers, signup } from "./support/session";

test("OWNER precisa do segundo fator antes de acessar as rotas da empresa", async ({ request }) => {
  const owner = await signup(request, "Empresa Alfa E2E");

  const blocked = await request.get("/api/company");
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error).toBe("mfa_enrollment_required");

  await enrollMfa(request);

  const company = await request.get("/api/company");
  expect(company.status()).toBe(200);
  expect((await company.json()).company).toMatchObject({ id: owner.companyId, name: "Empresa Alfa E2E" });

  const session = await request.get("/api/auth/session");
  expect((await session.json()).mfa).toEqual({ required: true, configured: true, verified: true });
});

test("empresa ativa: dados da empresa e membros vêm sempre da sessão", async ({ request }) => {
  const owner = await signup(request, "Empresa Alfa E2E");
  await enrollMfa(request);

  const members = await request.get("/api/company/members");
  expect(members.status()).toBe(200);
  const { members: list } = (await members.json()) as { members: Array<Record<string, unknown>> };
  expect(list).toEqual([
    expect.objectContaining({ userId: owner.userId, email: owner.account.email, status: "ACTIVE", roleKeys: ["OWNER"] }),
  ]);
  expect(JSON.stringify(list)).not.toMatch(/password|cpf|secret/i);

  const member = await request.get(`/api/company/members/${owner.userId}`);
  expect(member.status()).toBe(200);
});

test("pessoa de outra empresa não acessa membros nem seleciona a empresa alheia", async ({ request, baseURL }) => {
  const alpha = await signup(request, "Empresa Alfa E2E");
  await enrollMfa(request);

  const other = await playwrightRequest.newContext({ baseURL });
  try {
    const beta = await signup(other, "Empresa Beta E2E");
    await enrollMfa(other);

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
  await enrollMfa(request);

  for (const id of [randomUUID(), "nao-e-uuid", "..%2F..%2Fetc"]) {
    const response = await request.get(`/api/company/members/${id}`);
    expect(response.status(), id).toBe(404);
  }
});

test("código do segundo fator inválido é recusado e o mesmo código não vale duas vezes", async ({ request }) => {
  await signup(request, "Empresa Delta E2E");
  const { code, recoveryCodes } = await enrollMfa(request);

  const invalid = await request.post("/api/auth/mfa/verify", { data: { code: "000000" }, headers: headers() });
  expect(invalid.status()).toBe(401);
  expect((await invalid.json()).error).toBe("invalid_code");

  // Código já usado na confirmação do cadastro.
  const replay = await request.post("/api/auth/mfa/verify", { data: { code }, headers: headers() });
  expect(replay.status()).toBe(401);

  const recovery = await request.post("/api/auth/mfa/verify", {
    data: { code: recoveryCodes[0] },
    headers: headers(),
  });
  expect(recovery.status()).toBe(200);
  expect(await recovery.json()).toEqual({ method: "recovery_code", remainingRecoveryCodes: 9 });
});

test("sem sessão responde 401 e a troca de empresa exige mesma origem", async ({ request }) => {
  for (const path of ["/api/company", "/api/company/members", `/api/company/members/${randomUUID()}`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect((await response.json()).error).toBe("unauthenticated");
  }

  const withoutOrigin = await request.post("/api/auth/active-company", { data: { companyId: randomUUID() } });
  expect(withoutOrigin.status()).toBe(403);

  const unauthenticated = await request.post("/api/auth/mfa/enroll", { headers: headers() });
  expect(unauthenticated.status()).toBe(401);
});
