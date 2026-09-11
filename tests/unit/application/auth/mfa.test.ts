import { describe, expect, it } from "vitest";
import { createMfaUseCases } from "@/application/auth/mfa";
import { createSessionManager } from "@/application/auth/session-manager";
import {
  createFakeAudit,
  createFakeClock,
  createFakeIdentity,
  createFakeMfa,
  createFakeMfaService,
  createFakeRateLimiter,
  createFakeTokens,
  createInMemorySessions,
  fakeProtector,
} from "./fakes";

const context = { ipAddress: "203.0.113.10", userAgent: "teste" };
const VALID_CODE = "123456";

async function setup(options: { credential?: { confirmed?: boolean; secret?: string }; blocked?: boolean } = {}) {
  const clock = createFakeClock();
  const identity = createFakeIdentity();
  const user = identity.addUser({ email: "maria@example.com", password: "uma frase longa e secreta" });
  const store = createInMemorySessions();
  const sessions = createSessionManager({ sessions: store.repository, tokens: createFakeTokens(), now: clock.now });
  const mfa = createFakeMfa(options.credential ?? {});
  const { service, advanceStep } = createFakeMfaService(VALID_CODE);
  const { audit, events } = createFakeAudit();
  const { limiter } = createFakeRateLimiter(options.blocked ? ["auth:mfa:"] : []);

  const issued = await sessions.issue({ userId: user.userId, activeCompanyId: "company-1", ...context });

  return {
    user,
    store,
    mfa,
    events,
    advanceStep,
    token: issued.token,
    useCases: createMfaUseCases({
      sessions,
      identity: identity.identity,
      mfa: mfa.repository,
      service,
      protector: fakeProtector,
      rateLimiter: limiter,
      audit,
      now: clock.now,
    }),
  };
}

describe("cadastro do segundo fator", () => {
  it("gera segredo e URI do app, sem confirmar ainda", async () => {
    const { useCases, mfa, events, token } = await setup();

    const result = await useCases.start(token, context);

    expect(result).toMatchObject({ ok: true, secret: "SECRETOFAKE234567" });
    if (!result.ok) throw new Error("esperava sucesso");
    expect(result.keyUri).toContain("otpauth://totp/VELDOCS:maria@example.com");
    expect(mfa.state).toMatchObject({ secret: "SECRETOFAKE234567", confirmed: false });
    expect(events.map((event) => event.action)).toEqual(["auth.mfa_enrollment_started"]);
  });

  it("recusa iniciar quando já está ativo e exige sessão", async () => {
    const { useCases, token } = await setup({ credential: { confirmed: true, secret: "JASECRETO" } });

    await expect(useCases.start(token, context)).resolves.toEqual({ ok: false, reason: "already_enabled" });
    await expect(useCases.start(undefined, context)).resolves.toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("confirma com código válido, entrega 10 códigos de recuperação e marca a sessão", async () => {
    const { useCases, mfa, store, events, token } = await setup({ credential: { secret: "SEGREDO" } });

    const result = await useCases.confirm(token, { code: VALID_CODE }, context);

    if (!result.ok) throw new Error(`esperava sucesso: ${result.reason}`);
    expect(result.recoveryCodes).toHaveLength(10);
    for (const code of result.recoveryCodes) expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect(mfa.state.confirmed).toBe(true);
    expect(mfa.state.codes.size).toBe(10);
    expect(store.rows.get(`hash(${token})`)?.mfaVerifiedAt).not.toBeNull();
    expect(events.map((event) => event.action)).toEqual(["auth.mfa_enabled"]);
  });

  it("recusa código inválido, cadastro não iniciado e segundo fator já ativo", async () => {
    const pending = await setup({ credential: { secret: "SEGREDO" } });
    await expect(pending.useCases.confirm(pending.token, { code: "000000" }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
    expect(pending.mfa.state.confirmed).toBe(false);
    expect(pending.events.map((event) => event.action)).toEqual(["auth.mfa_failed"]);

    const missing = await setup();
    await expect(missing.useCases.confirm(missing.token, { code: VALID_CODE }, context)).resolves.toEqual({
      ok: false,
      reason: "not_started",
    });

    const enabled = await setup({ credential: { confirmed: true, secret: "SEGREDO" } });
    await expect(enabled.useCases.confirm(enabled.token, { code: VALID_CODE }, context)).resolves.toEqual({
      ok: false,
      reason: "already_enabled",
    });
  });
});

describe("verificação do segundo fator", () => {
  async function enrolled() {
    const context1 = await setup({ credential: { secret: "SEGREDO" } });
    const confirmation = await context1.useCases.confirm(context1.token, { code: VALID_CODE }, context);
    if (!confirmation.ok) throw new Error("falha ao confirmar");
    context1.events.length = 0;
    return { ...context1, recoveryCodes: confirmation.recoveryCodes };
  }

  it("aceita o código do app na janela seguinte e marca a sessão", async () => {
    const { useCases, store, events, advanceStep, token } = await enrolled();
    store.rows.set(`hash(${token})`, { ...store.rows.get(`hash(${token})`)!, mfaVerifiedAt: null });
    advanceStep();

    const result = await useCases.verify(token, { code: VALID_CODE }, context);

    expect(result).toMatchObject({ ok: true, method: "totp", remainingRecoveryCodes: 10 });
    expect(store.rows.get(`hash(${token})`)?.mfaVerifiedAt).not.toBeNull();
    expect(events.map((event) => event.action)).toEqual(["auth.mfa_verified"]);
  });

  it("recusa o mesmo código do app duas vezes (replay)", async () => {
    const { useCases, advanceStep, token } = await enrolled();
    advanceStep();

    await expect(useCases.verify(token, { code: VALID_CODE }, context)).resolves.toMatchObject({ ok: true });
    await expect(useCases.verify(token, { code: VALID_CODE }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("aceita um código de recuperação uma única vez e reduz o saldo", async () => {
    const { useCases, recoveryCodes, token } = await enrolled();
    const [first] = recoveryCodes;

    await expect(useCases.verify(token, { code: first as string }, context)).resolves.toMatchObject({
      ok: true,
      method: "recovery_code",
      remainingRecoveryCodes: 9,
    });
    await expect(useCases.verify(token, { code: first as string }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("recusa sem cadastro, sem sessão e com entrada inválida", async () => {
    const { useCases, token } = await setup();

    await expect(useCases.verify(token, { code: VALID_CODE }, context)).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
    await expect(useCases.verify(undefined, { code: VALID_CODE }, context)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    await expect(useCases.verify(token, { code: "12" }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("bloqueia por tentativas antes de validar o código", async () => {
    const { useCases, events, token } = await setup({ credential: { confirmed: true, secret: "SEGREDO" }, blocked: true });

    const result = await useCases.verify(token, { code: VALID_CODE }, context);

    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(events.map((event) => event.action)).toEqual(["auth.mfa_rate_limited"]);
  });
});
