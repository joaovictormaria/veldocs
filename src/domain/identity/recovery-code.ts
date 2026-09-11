/**
 * Códigos de recuperação do segundo fator: 10 caracteres do alfabeto base32
 * (A–Z, 2–7), exibidos uma única vez em grupos de cinco (`ABCDE-FGHIJ`).
 * São guardados apenas como HMAC-SHA256 e valem uma única vez.
 */
export const RECOVERY_CODE_LENGTH = 10;
export const RECOVERY_CODE_COUNT = 10;

const RECOVERY_CODE_PATTERN = /^[A-Z2-7]{10}$/;

/** Aceita a entrada com hífens, espaços e minúsculas. */
export function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function isValidRecoveryCode(value: string): boolean {
  return RECOVERY_CODE_PATTERN.test(normalizeRecoveryCode(value));
}

export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}
