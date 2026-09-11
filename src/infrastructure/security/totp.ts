import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { decodeBase32IgnorePadding, encodeBase32UpperCaseNoPadding } from "@oslojs/encoding";

/**
 * TOTP conforme a RFC 6238 (HMAC-SHA1, 6 dígitos, janela de 30 s) — os
 * parâmetros compatíveis com Google Authenticator, Microsoft Authenticator,
 * 1Password e similares.
 *
 * A verificação devolve o passo de tempo aceito para que o chamador grave o
 * último passo usado e recuse a reapresentação do mesmo código (replay).
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Tolerância de relógio: um passo para trás e um para frente. */
export const TOTP_WINDOW_STEPS = 1;

export function generateTotpSecret(byteLength = 20): string {
  return encodeBase32UpperCaseNoPadding(randomBytes(byteLength));
}

export function totpStep(at: Date, periodSeconds = TOTP_PERIOD_SECONDS): number {
  return Math.floor(at.getTime() / 1000 / periodSeconds);
}

export function totpCode(secret: string, step: number, digits = TOTP_DIGITS): string {
  const key = decodeBase32IgnorePadding(secret.toUpperCase());
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const truncated = digest.readUInt32BE(offset) & 0x7fff_ffff;

  return (truncated % 10 ** digits).toString().padStart(digits, "0");
}

export interface TotpVerification {
  /** Passo de tempo aceito; gravar para impedir reuso. */
  readonly step: number;
}

export function verifyTotpCode(input: {
  readonly secret: string;
  readonly code: string;
  readonly at: Date;
  readonly lastUsedStep?: number | null;
  readonly digits?: number;
  readonly windowSteps?: number;
}): TotpVerification | null {
  const digits = input.digits ?? TOTP_DIGITS;
  if (!new RegExp(`^\\d{${digits}}$`).test(input.code)) return null;

  const current = totpStep(input.at);
  const window = input.windowSteps ?? TOTP_WINDOW_STEPS;
  const provided = Buffer.from(input.code, "utf8");

  for (let step = current - window; step <= current + window; step += 1) {
    if (step < 0) continue;
    if (input.lastUsedStep != null && step <= input.lastUsedStep) continue;

    const expected = Buffer.from(totpCode(input.secret, step, digits), "utf8");
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return { step };
  }

  return null;
}

/** URI `otpauth://` lida pelo QR Code do app autenticador. */
export function buildTotpKeyUri(input: {
  readonly issuer: string;
  readonly accountName: string;
  readonly secret: string;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Alfabeto base32 (RFC 4648): sem 0, 1, 8 e 9, evitando confusão na digitação. */
const RECOVERY_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateRecoveryCode(length: number): string {
  return Array.from({ length }, () => RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)]).join("");
}
