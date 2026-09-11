import { describe, expect, it } from "vitest";
import {
  buildTotpKeyUri,
  generateRecoveryCode,
  generateTotpSecret,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  totpCode,
  totpStep,
  verifyTotpCode,
} from "@/infrastructure/security/totp";

/** Chave dos vetores oficiais da RFC 6238 ("12345678901234567890" em base32). */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP (RFC 6238)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("reproduz o código oficial em T=%i", (seconds, expected) => {
    expect(totpCode(RFC_SECRET, Math.floor(seconds / 30), 8)).toBe(expected);
  });

  it("usa os parâmetros compatíveis com os apps autenticadores", () => {
    expect({ TOTP_DIGITS, TOTP_PERIOD_SECONDS }).toEqual({ TOTP_DIGITS: 6, TOTP_PERIOD_SECONDS: 30 });
  });

  it("gera segredos base32 distintos de 160 bits", () => {
    const secrets = new Set(Array.from({ length: 20 }, () => generateTotpSecret()));
    expect(secrets.size).toBe(20);
    for (const secret of secrets) expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("verificação", () => {
  const secret = generateTotpSecret();
  const at = new Date("2026-09-11T12:00:00.000Z");
  const step = totpStep(at);

  it("aceita o código do passo atual e informa qual passo foi usado", () => {
    expect(verifyTotpCode({ secret, code: totpCode(secret, step), at })).toEqual({ step });
  });

  it("aceita um passo de tolerância para trás e para frente (relógio dessincronizado)", () => {
    expect(verifyTotpCode({ secret, code: totpCode(secret, step - 1), at })).toEqual({ step: step - 1 });
    expect(verifyTotpCode({ secret, code: totpCode(secret, step + 1), at })).toEqual({ step: step + 1 });
    expect(verifyTotpCode({ secret, code: totpCode(secret, step + 2), at })).toBeNull();
  });

  it("recusa reapresentar um código já usado (replay)", () => {
    expect(verifyTotpCode({ secret, code: totpCode(secret, step), at, lastUsedStep: step })).toBeNull();
    expect(verifyTotpCode({ secret, code: totpCode(secret, step - 1), at, lastUsedStep: step })).toBeNull();
    expect(verifyTotpCode({ secret, code: totpCode(secret, step + 1), at, lastUsedStep: step })).toEqual({
      step: step + 1,
    });
  });

  it.each(["", "12345", "1234567", "abcdef", "12 34 56"])("recusa o formato %j", (code) => {
    expect(verifyTotpCode({ secret, code, at })).toBeNull();
  });

  it("recusa o código de outro segredo", () => {
    expect(verifyTotpCode({ secret, code: totpCode(generateTotpSecret(), step), at })).toBeNull();
  });
});

describe("URI para o app autenticador", () => {
  it("inclui emissor, conta e parâmetros", () => {
    const uri = new URL(buildTotpKeyUri({ issuer: "VELDOCS", accountName: "maria@example.com", secret: RFC_SECRET }));

    expect(uri.protocol).toBe("otpauth:");
    expect(decodeURIComponent(uri.pathname)).toContain("VELDOCS:maria@example.com");
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: RFC_SECRET,
      issuer: "VELDOCS",
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
  });
});

describe("códigos de recuperação", () => {
  it("gera códigos base32 distintos", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode(10)));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{10}$/);
  });
});
