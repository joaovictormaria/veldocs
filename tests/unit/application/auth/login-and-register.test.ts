import { describe, expect, it } from "vitest";
import { createLoginUseCase } from "@/application/auth/login";
import { createRegisterUseCase } from "@/application/auth/register";
import { createSessionManager } from "@/application/auth/session-manager";
import { SYSTEM_ROLE_KEYS } from "@/domain/access-control/system-roles";
import {
  createFakeAudit,
  createFakeClock,
  createFakeHasher,
  createFakeIdentity,
  createFakeRateLimiter,
  createFakeTokens,
  createInMemorySessions,
  fakeProtector,
} from "./fakes";

const context = { ipAddress: "203.0.113.10", userAgent: "teste" };
const PASSWORD = "uma frase longa e secreta";
const CPF = "52998224725";

function setup(blockedPrefixes: readonly string[] = []) {
  const clock = createFakeClock();
  const identity = createFakeIdentity();
  const { hasher, verifiedHashes } = createFakeHasher();
  const { limiter, consumed } = createFakeRateLimiter(blockedPrefixes);
  const { audit, events } = createFakeAudit();
  const sessionStore = createInMemorySessions();
  const sessions = createSessionManager({ sessions: sessionStore.repository, tokens: createFakeTokens(), now: clock.now });
  const dependencies = {
    identity: identity.identity,
    hasher,
    protector: fakeProtector,
    sessions,
    rateLimiter: limiter,
    audit,
    now: clock.now,
  };

  return {
    identity,
    verifiedHashes,
    consumed,
    events,
    sessions,
    login: createLoginUseCase(dependencies),
    register: createRegisterUseCase({ ...dependencies, randomSlugSuffix: () => "abc12345" }),
  };
}

describe("login", () => {
  it("autentica por e-mail e define a empresa ativa quando há um único vínculo ativo", async () => {
    const { identity, login, events } = setup();
    const user = identity.addUser({ email: "maria@example.com", password: PASSWORD });
    identity.memberships.set(user.userId, [
      { companyId: "company-1", companyName: "Empresa", status: "ACTIVE", roleKeys: ["OWNER"] },
      { companyId: "company-2", companyName: "Antiga", status: "SUSPENDED", roleKeys: ["GESTOR"] },
    ]);

    const result = await login({ identifier: " Maria@Example.com ", password: PASSWORD }, context);

    expect(result).toMatchObject({ ok: true, userId: user.userId });
    if (!result.ok) throw new Error("login falhou");
    expect(result.session.activeCompanyId).toBe("company-1");
    expect(identity.logins).toEqual([user.userId]);
    expect(events.map((event) => event.action)).toEqual(["auth.login_succeeded"]);
    expect(events[0]?.metadata).toEqual({ method: "password_email" });
  });

  it("autentica por CPF usando o hash de busca", async () => {
    const { identity, login } = setup();
    identity.addUser({ email: "joao@example.com", password: PASSWORD, cpfLookupHash: `hmac(cpf:${CPF})` });

    await expect(login({ identifier: "529.982.247-25", password: PASSWORD }, context)).resolves.toMatchObject({ ok: true });
  });

  it("não define empresa ativa quando há vários vínculos ativos", async () => {
    const { identity, login } = setup();
    const user = identity.addUser({ email: "contador@example.com", password: PASSWORD });
    identity.memberships.set(user.userId, [
      { companyId: "company-1", companyName: "A", status: "ACTIVE", roleKeys: ["GESTOR"] },
      { companyId: "company-2", companyName: "B", status: "ACTIVE", roleKeys: ["GESTOR"] },
    ]);

    const result = await login({ identifier: "contador@example.com", password: PASSWORD }, context);

    if (!result.ok) throw new Error("login falhou");
    expect(result.session.activeCompanyId).toBeNull();
  });

  it("responde igual para senha errada, conta inexistente, conta desativada e identificador inválido", async () => {
    const { identity, login, verifiedHashes, events } = setup();
    identity.addUser({ email: "maria@example.com", password: PASSWORD });
    identity.addUser({ email: "inativa@example.com", password: PASSWORD, status: "DISABLED" });

    const attempts = await Promise.all([
      login({ identifier: "maria@example.com", password: "senha errada qualquer" }, context),
      login({ identifier: "ninguem@example.com", password: PASSWORD }, context),
      login({ identifier: "inativa@example.com", password: PASSWORD }, context),
      login({ identifier: "não é e-mail nem cpf", password: PASSWORD }, context),
    ]);

    for (const attempt of attempts) expect(attempt).toEqual({ ok: false, reason: "invalid_credentials" });
    // Conta inexistente e identificador inválido também passam por uma verificação de senha (tempo equalizado).
    expect(verifiedHashes).toHaveLength(4);
    expect(events.filter((event) => event.action === "auth.login_failed")).toHaveLength(4);
  });

  it("bloqueia por rate limit antes de consultar a conta ou verificar a senha", async () => {
    const { identity, login, verifiedHashes, events } = setup(["auth:login:account:"]);
    identity.addUser({ email: "maria@example.com", password: PASSWORD });

    const result = await login({ identifier: "maria@example.com", password: PASSWORD }, context);

    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    if (result.ok || result.reason !== "rate_limited") throw new Error("esperava rate_limited");
    expect(result.retryAfterSeconds).toBe(600);
    expect(verifiedHashes).toHaveLength(0);
    expect(events.map((event) => event.action)).toEqual(["auth.login_rate_limited"]);
  });

  it("aplica limite por IP e por conta usando HMAC do identificador normalizado", async () => {
    const { login, consumed } = setup();

    await login({ identifier: "Maria@Example.com", password: PASSWORD }, context);

    expect(consumed.map((entry) => entry.key)).toEqual([
      "auth:login:ip:203.0.113.10",
      "auth:login:account:hmac(rate-limit:email:maria@example.com)",
    ]);
  });

  it("rejeita entrada malformada sem consumir tentativas", async () => {
    const { login, consumed } = setup();

    await expect(login({ identifier: "", password: PASSWORD }, context)).resolves.toEqual({ ok: false, reason: "invalid_input" });
    await expect(login("texto", context)).resolves.toEqual({ ok: false, reason: "invalid_input" });
    expect(consumed).toHaveLength(0);
  });

  it("nunca registra identificador ou senha na auditoria", async () => {
    const { identity, login, events } = setup();
    identity.addUser({ email: "maria@example.com", password: PASSWORD, cpfLookupHash: `hmac(cpf:${CPF})` });

    await login({ identifier: "maria@example.com", password: "senha errada qualquer" }, context);
    await login({ identifier: CPF, password: PASSWORD }, context);

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("maria@example.com");
    expect(serialized).not.toContain(CPF);
    expect(serialized).not.toContain(PASSWORD);
  });
});

describe("cadastro", () => {
  const validInput = {
    name: "  Maria Silva ",
    email: "Maria@Example.com",
    password: PASSWORD,
    cpf: "529.982.247-25",
    companyName: "Padaria São João",
  };

  it("cria conta com senha em hash, CPF protegido, perfis padrão e sessão na nova empresa", async () => {
    const { register, identity, events } = setup();

    const result = await register(validInput, context);

    expect(result).toMatchObject({ ok: true, userId: "user-1", companyId: "company-1" });
    if (!result.ok) throw new Error("cadastro falhou");
    expect(result.session.activeCompanyId).toBe("company-1");

    const [account] = identity.createdAccounts;
    expect(account).toMatchObject({
      name: "Maria Silva",
      email: "maria@example.com",
      passwordHash: `hashed(${PASSWORD})`,
      cpf: { lookupHash: `hmac(cpf:${CPF})`, encrypted: `enc(${CPF})` },
      company: { name: "Padaria São João", slug: "padaria-sao-joao-abc12345" },
      creatorRoleKey: "OWNER",
    });
    expect(account?.roles.map((role) => role.key)).toEqual([...SYSTEM_ROLE_KEYS]);
    expect(events.map((event) => event.action)).toEqual(["auth.account_registered", "company.created"]);
    expect(JSON.stringify(events)).not.toContain(CPF);
  });

  it("aceita cadastro sem CPF (opcional)", async () => {
    const { register, identity } = setup();

    await expect(register({ ...validInput, cpf: "" }, context)).resolves.toMatchObject({ ok: true });
    await expect(register({ ...validInput, email: "outra@example.com", cpf: undefined }, context)).resolves.toMatchObject({ ok: true });
    expect(identity.createdAccounts.map((account) => account.cpf)).toEqual([null, null]);
  });

  it("aponta os campos inválidos", async () => {
    const { register, identity } = setup();

    const result = await register({ ...validInput, email: "x", password: "curta", cpf: "123" }, context);

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    if (result.ok || result.reason !== "invalid_input") throw new Error("esperava invalid_input");
    expect(result.issues.map((issue) => issue.field).sort()).toEqual(["cpf", "email", "password"]);
    expect(identity.createdAccounts).toHaveLength(0);
  });

  it("responde de forma genérica quando e-mail ou CPF já existem", async () => {
    const { register } = setup();
    await register(validInput, context);

    await expect(register({ ...validInput, companyName: "Outra" }, context)).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(register({ ...validInput, email: "nova@example.com" }, context)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("aplica rate limit por IP antes de validar ou criar qualquer coisa", async () => {
    const { register, identity, events } = setup(["auth:register:ip:"]);

    await expect(register(validInput, context)).resolves.toMatchObject({ ok: false, reason: "rate_limited" });
    expect(identity.createdAccounts).toHaveLength(0);
    expect(events.map((event) => event.action)).toEqual(["auth.register_rate_limited"]);
  });
});
