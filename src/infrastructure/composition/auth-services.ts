import "server-only";
import { createAuthorizer } from "@/application/access/authorize";
import { createCompanyQueries } from "@/application/access/company-queries";
import { createCompanyManagement } from "@/application/access/manage-company";
import { createSelectActiveCompany } from "@/application/access/select-active-company";
import { createLoginUseCase } from "@/application/auth/login";
import { createMfaUseCases } from "@/application/auth/mfa";
import { createRegisterUseCase } from "@/application/auth/register";
import { createSessionManager } from "@/application/auth/session-manager";
import { createSessionUseCases } from "@/application/auth/session-use-cases";
import type { PrismaClient } from "@/generated/prisma/client";
import { createCoreOnlyEntitlementService } from "@/infrastructure/access/core-only-entitlements";
import { getEnv } from "@/infrastructure/config/env";
import {
  createPrismaAccessControlRepository,
  createPrismaCompanyDirectory,
} from "@/infrastructure/database/prisma-access-control-repository";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaCompanyManagementRepository } from "@/infrastructure/database/prisma-company-management-repository";
import { createPrismaMfaRepository } from "@/infrastructure/database/prisma-mfa-repository";
import { getPrismaClient } from "@/infrastructure/database/prisma-client";
import { createPrismaIdentityRepository } from "@/infrastructure/database/prisma-identity-repository";
import { createPrismaRateLimiter } from "@/infrastructure/database/prisma-rate-limiter";
import { createPrismaSessionRepository } from "@/infrastructure/database/prisma-session-repository";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import { createMfaService } from "@/infrastructure/security/mfa-service";
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

  const access = createPrismaAccessControlRepository(prisma);
  const mfa = createPrismaMfaRepository(prisma, keys);

  return {
    login: createLoginUseCase(dependencies),
    register: createRegisterUseCase({ ...dependencies, randomSlugSuffix: generateSlugSuffix }),
    ...createSessionUseCases({ sessions, identity, access, mfa, audit }),
    authorize: createAuthorizer({
      sessions,
      identity,
      access,
      mfa,
      entitlements: createCoreOnlyEntitlementService(),
    }),
    selectActiveCompany: createSelectActiveCompany({ sessions, identity, access, audit }),
    company: createCompanyQueries(createPrismaCompanyDirectory(prisma)),
    companyManagement: createCompanyManagement({
      repository: createPrismaCompanyManagementRepository(prisma),
      audit,
      now,
    }),
    rateLimiter: dependencies.rateLimiter,
    mfa: createMfaUseCases({ ...dependencies, mfa, service: createMfaService() }),
  };
}

export type AuthServices = ReturnType<typeof buildAuthServices>;

let cachedServices: AuthServices | undefined;

export function getAuthServices(): AuthServices {
  cachedServices ??= buildAuthServices(getPrismaClient(), getEnv());
  return cachedServices;
}
