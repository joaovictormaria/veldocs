import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createFieldEncryptor } from "@/infrastructure/security/crypto";
import { totpCode, totpStep } from "@/infrastructure/security/totp";
import {
  TEST_APPLICATION_KEYS,
  createTestAuthServices,
  createTestPrismaClient,
  truncateAllTables,
} from "../support/database";

const PASSWORD = "uma frase longa e secreta";
const context = { ipAddress: "203.0.113.30", userAgent: "vitest" };

let prisma: PrismaClient;
let auth: AuthServices;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  auth = createTestAuthServices(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerOwner() {
  const result = await auth.register(
    {
      name: "Dona da Empresa",
      email: `mfa-${randomUUID().slice(0, 8)}@example.com`,
      password: PASSWORD,
      companyName: "Empresa MFA",
    },
    context,
  );
  if (!result.ok) throw new Error("cadastro falhou");
  return result;
}

const currentCode = (secret: string, offsetSteps = 0) => totpCode(secret, totpStep(new Date()) + offsetSteps);

describe("segundo fator (TOTP)", () => {
  it("cadastra, confirma, guarda o segredo cifrado e entrega códigos de recuperação", async () => {
    const owner = await registerOwner();
    const token = owner.session.token;

    const start = await auth.mfa.start(token, context);
    if (!start.ok) throw new Error("falha ao iniciar");
    expect(start.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(decodeURIComponent(start.keyUri)).toContain("otpauth://totp/VELDOCS:");

    const pending = await prisma.userTotpCredential.findUniqueOrThrow({ where: { userId: owner.userId } });
    expect(pending.confirmedAt).toBeNull();
    expect(pending.secretEncrypted).not.toContain(start.secret);
    const cipher = createFieldEncryptor(
      Buffer.from(TEST_APPLICATION_KEYS.APP_ENCRYPTION_KEY, "base64"),
      "users.totp_secret",
    );
    expect(cipher.decrypt(pending.secretEncrypted)).toBe(start.secret);

    const confirmation = await auth.mfa.confirm(token, { code: currentCode(start.secret) }, context);
    if (!confirmation.ok) throw new Error(`falha ao confirmar: ${confirmation.reason}`);
    expect(confirmation.recoveryCodes).toHaveLength(10);

    const confirmed = await prisma.userTotpCredential.findUniqueOrThrow({ where: { userId: owner.userId } });
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(await prisma.userRecoveryCode.count({ where: { userId: owner.userId, usedAt: null } })).toBe(10);

    const codes = await prisma.userRecoveryCode.findMany({ where: { userId: owner.userId } });
    for (const code of codes) expect(code.codeHash).toMatch(/^[0-9a-f]{64}$/);
    const plain = confirmation.recoveryCodes[0]?.replace("-", "") ?? "";
    expect(codes.some((code) => code.codeHash.includes(plain))).toBe(false);

    const session = await auth.getCurrentSession(token);
    expect(session?.mfa).toEqual({ required: true, configured: true, verified: true });
    expect(await prisma.auditLog.count({ where: { action: "auth.mfa_enabled" } })).toBe(1);
  });

  it("recusa código inválido na confirmação e mantém o cadastro pendente", async () => {
    const owner = await registerOwner();
    const start = await auth.mfa.start(owner.session.token, context);
    if (!start.ok) throw new Error("falha ao iniciar");

    await expect(auth.mfa.confirm(owner.session.token, { code: "000000" }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
    expect((await prisma.userTotpCredential.findUniqueOrThrow({ where: { userId: owner.userId } })).confirmedAt).toBeNull();
  });

  it("verifica com o app, recusa o mesmo código duas vezes e aceita código de recuperação uma única vez", async () => {
    const owner = await registerOwner();
    const token = owner.session.token;
    const start = await auth.mfa.start(token, context);
    if (!start.ok) throw new Error("falha ao iniciar");
    const confirmation = await auth.mfa.confirm(token, { code: currentCode(start.secret, -1) }, context);
    if (!confirmation.ok) throw new Error("falha ao confirmar");

    const verification = await auth.mfa.verify(token, { code: currentCode(start.secret) }, context);
    expect(verification).toMatchObject({ ok: true, method: "totp", remainingRecoveryCodes: 10 });

    await expect(auth.mfa.verify(token, { code: currentCode(start.secret) }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });

    const [recoveryCode] = confirmation.recoveryCodes;
    await expect(auth.mfa.verify(token, { code: recoveryCode as string }, context)).resolves.toMatchObject({
      ok: true,
      method: "recovery_code",
      remainingRecoveryCodes: 9,
    });
    await expect(auth.mfa.verify(token, { code: recoveryCode as string }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("o segundo fator vale por sessão: a sessão nova precisa verificar de novo", async () => {
    const owner = await registerOwner();
    const start = await auth.mfa.start(owner.session.token, context);
    if (!start.ok) throw new Error("falha ao iniciar");
    const confirmation = await auth.mfa.confirm(owner.session.token, { code: currentCode(start.secret) }, context);
    if (!confirmation.ok) throw new Error("falha ao confirmar");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId }, select: { email: true } });
    const login = await auth.login({ identifier: user.email, password: PASSWORD }, context);
    if (!login.ok) throw new Error("login falhou");

    const session = await auth.getCurrentSession(login.session.token);
    expect(session?.mfa).toEqual({ required: true, configured: true, verified: false });
    await expect(auth.authorize(login.session.token, "company.read")).resolves.toEqual({
      ok: false,
      reason: "mfa_required",
    });

    const [recoveryCode] = confirmation.recoveryCodes;
    await expect(auth.mfa.verify(login.session.token, { code: recoveryCode as string }, context)).resolves.toMatchObject(
      { ok: true },
    );
    await expect(auth.authorize(login.session.token, "company.read")).resolves.toMatchObject({ ok: true });
  });

  it("bloqueia após 10 tentativas em 15 minutos", async () => {
    const owner = await registerOwner();
    const start = await auth.mfa.start(owner.session.token, context);
    if (!start.ok) throw new Error("falha ao iniciar");
    await auth.mfa.confirm(owner.session.token, { code: currentCode(start.secret) }, context);

    for (let attempt = 0; attempt < 9; attempt += 1) {
      await expect(auth.mfa.verify(owner.session.token, { code: "000000" }, context)).resolves.toEqual({
        ok: false,
        reason: "invalid_code",
      });
    }

    const blocked = await auth.mfa.verify(owner.session.token, { code: currentCode(start.secret) }, context);
    expect(blocked).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(await prisma.auditLog.count({ where: { action: "auth.mfa_rate_limited" } })).toBe(1);
  });
});
