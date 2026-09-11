import "server-only";
import { createLoginUseCase } from "@/application/auth/login";
import { createRegisterUseCase } from "@/application/auth/register";
import { createSessionManager } from "@/application/auth/session-manager";
import { createSessionUseCases } from "@/application/auth/session-use-cases";
import type { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/infrastructure/config/env";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { getPrismaClient } from "@/infrastructure/database/prisma-client";
import { createPrismaIdentityRepository } from "@/infrastructure/database/prisma-identity-repository";
import { createPrismaRateLimiter } from "@/infrastructure/database/prisma-rate-limiter";
import { createPrismaSessionRepository } from "@/infrastructure/database/prisma-session-repository";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import {
  type ApplicationKeys,
  createSensitiveDataProtector,
  createTokenService,
  generateSlugSuffix,
} from "@/infrastructure/security/token-service";

/** Monta os casos de uso de autenticação com as implementações concretas. */
export function buildAuthServices(prisma: PrismaClient, keys: ApplicationKeys, now: () => Date = () => new Date()) {
  const identity = createPrismaIdentityRepository(prisma);
  const audit = createPrismaAuditLogger(prisma);
  const sessions = createSessionManager({
    sessions: createPrismaSessionRepository(prisma),
    tokens: createTokenService(),
    now,
  });
  const dependencies = {
    identity,
    audit,
    sessions,
    now,
    hasher: createArgon2PasswordHasher(),
    protector: createSensitiveDataProtector(keys),
    rateLimiter: createPrismaRateLimiter(prisma),
  };

  return {
    login: createLoginUseCase(dependencies),
    register: createRegisterUseCase({ ...dependencies, randomSlugSuffix: generateSlugSuffix }),
    ...createSessionUseCases({ sessions, identity, audit }),
  };
}

export type AuthServices = ReturnType<typeof buildAuthServices>;

let cachedServices: AuthServices | undefined;

export function getAuthServices(): AuthServices {
  cachedServices ??= buildAuthServices(getPrismaClient(), getEnv());
  return cachedServices;
}
