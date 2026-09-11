import { randomInt, randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";
import { totpCode, totpStep } from "../../../src/infrastructure/security/totp";

export const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

/** IP aleatório por requisição: o limite por IP persiste no banco entre execuções. */
export const headers = () => ({
  Origin: ORIGIN,
  "X-Forwarded-For": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(256)}`,
});

export async function signup(api: APIRequestContext, companyName: string) {
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

/** OWNER só acessa as rotas depois de cadastrar o app autenticador. */
export async function enrollMfa(api: APIRequestContext) {
  const start = await api.post("/api/auth/mfa/enroll", { headers: headers() });
  expect(start.status()).toBe(200);
  const { secret, keyUri } = (await start.json()) as { secret: string; keyUri: string };
  expect(decodeURIComponent(keyUri)).toContain("otpauth://totp/VELDOCS:");

  const code = totpCode(secret, totpStep(new Date()));
  const confirm = await api.post("/api/auth/mfa/enroll/confirm", { data: { code }, headers: headers() });
  expect(confirm.status()).toBe(200);
  const { recoveryCodes } = (await confirm.json()) as { recoveryCodes: string[] };
  expect(recoveryCodes).toHaveLength(10);
  return { secret, code, recoveryCodes };
}

/** Cria a conta e deixa a sessão pronta para usar as rotas da empresa. */
export async function signupWithMfa(api: APIRequestContext, companyName: string) {
  const account = await signup(api, companyName);
  await enrollMfa(api);
  return account;
}
