import { randomInt } from "node:crypto";
import type { SensitiveDataProtector, TokenService } from "@/application/ports/security-tokens";
import { createFieldEncryptor, createLookupHasher, generateToken, sha256Hex } from "./crypto";

/** 32 bytes em base64url = 43 caracteres. */
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createTokenService(): TokenService {
  return {
    generate: () => generateToken(32),
    hash: sha256Hex,
    isWellFormed: (token) => SESSION_TOKEN_PATTERN.test(token),
  };
}

export interface ApplicationKeys {
  /** base64, 32 bytes */
  readonly APP_ENCRYPTION_KEY: string;
  /** base64, 32+ bytes */
  readonly APP_HMAC_KEY: string;
}

export function createSensitiveDataProtector(keys: ApplicationKeys): SensitiveDataProtector {
  const lookup = createLookupHasher(Buffer.from(keys.APP_HMAC_KEY, "base64"));
  const cpfEncryptor = createFieldEncryptor(Buffer.from(keys.APP_ENCRYPTION_KEY, "base64"), "users.cpf");

  return {
    lookupHash: (purpose, value) => lookup(`${purpose}:${value}`),
    encryptCpf: (cpf) => cpfEncryptor.encrypt(cpf),
  };
}

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlugSuffix(length = 8): string {
  return Array.from({ length }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join("");
}
