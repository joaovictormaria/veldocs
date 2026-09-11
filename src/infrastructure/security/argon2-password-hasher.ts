import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "@/application/ports/password-hasher";

/**
 * Argon2id com os parâmetros mínimos recomendados pelo OWASP:
 * 19 MiB de memória, 2 iterações, paralelismo 1. O algoritmo padrão da
 * biblioteca é Argon2id (verificado em teste pelo prefixo do hash).
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function createArgon2PasswordHasher(): PasswordHasher {
  return {
    hash: (password) => hash(password, OPTIONS),
    async verify(passwordHash, password) {
      try {
        return await verify(passwordHash, password);
      } catch {
        return false;
      }
    },
  };
}
