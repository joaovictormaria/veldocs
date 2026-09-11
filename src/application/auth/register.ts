import { z } from "zod";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository } from "@/application/ports/identity-repository";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { SensitiveDataProtector } from "@/application/ports/security-tokens";
import { COMPANY_CREATOR_ROLE, PERMISSION_CATALOG, SYSTEM_ROLES } from "@/domain/access-control/system-roles";
import { buildCompanySlug } from "@/domain/company/slug";
import { cpfSchema } from "@/domain/identity/cpf";
import { emailSchema } from "@/domain/identity/email";
import { passwordSchema } from "@/domain/identity/password-policy";
import type { IssuedSession, SessionManager } from "./session-manager";
import {
  AccountAlreadyExistsError,
  AUTH_AUDIT_ACTIONS,
  AUTH_RATE_LIMITS,
  auditContext,
  ipRateLimitKey,
  type RequestContext,
  retryAfterSeconds,
} from "./shared";

export const registerInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe seu nome" }).max(200),
  email: emailSchema,
  password: passwordSchema,
  /** CPF é opcional; string vazia equivale a não informado. */
  cpf: z.union([z.literal("").transform(() => undefined), cpfSchema]).optional(),
  companyName: z.string().trim().min(2, { error: "informe o nome da empresa" }).max(200),
});

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

export type RegisterResult =
  | { readonly ok: true; readonly userId: string; readonly companyId: string; readonly session: IssuedSession }
  | { readonly ok: false; readonly reason: "invalid_input"; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly reason: "unavailable" }
  | { readonly ok: false; readonly reason: "rate_limited"; readonly retryAfterSeconds: number };

export interface RegisterDependencies {
  readonly identity: IdentityRepository;
  readonly hasher: PasswordHasher;
  readonly protector: SensitiveDataProtector;
  readonly sessions: SessionManager;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditLogger;
  readonly now: () => Date;
  readonly randomSlugSuffix: () => string;
}

/**
 * Cadastro público: cria a pessoa, a empresa com os perfis padrão e o vínculo
 * como OWNER, e já inicia a sessão nessa empresa.
 * E-mail ou CPF já cadastrados geram resposta genérica ("unavailable").
 */
export function createRegisterUseCase(deps: RegisterDependencies) {
  return async function register(rawInput: unknown, context: RequestContext): Promise<RegisterResult> {
    const limit = await deps.rateLimiter.consume(ipRateLimitKey("auth:register", context), AUTH_RATE_LIMITS.registerPerIp);
    if (!limit.allowed) {
      await deps.audit.record({
        companyId: null,
        actorUserId: null,
        action: AUTH_AUDIT_ACTIONS.registerRateLimited,
        ...auditContext(context),
      });
      return { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfterSeconds([limit], deps.now()) };
    }

    const input = registerInputSchema.safeParse(rawInput);
    if (!input.success) {
      return {
        ok: false,
        reason: "invalid_input",
        issues: input.error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message })),
      };
    }

    const { name, email, password, cpf, companyName } = input.data;

    let created: { userId: string; companyId: string };
    try {
      created = await deps.identity.createAccountWithCompany({
        name,
        email,
        passwordHash: await deps.hasher.hash(password),
        cpf: cpf ? { lookupHash: deps.protector.lookupHash("cpf", cpf), encrypted: deps.protector.encryptCpf(cpf) } : null,
        company: { name: companyName, slug: buildCompanySlug(companyName, deps.randomSlugSuffix()) },
        roles: Object.values(SYSTEM_ROLES),
        creatorRoleKey: COMPANY_CREATOR_ROLE,
        permissionCatalog: PERMISSION_CATALOG,
      });
    } catch (error) {
      if (error instanceof AccountAlreadyExistsError) return { ok: false, reason: "unavailable" };
      throw error;
    }

    const session = await deps.sessions.issue({ userId: created.userId, activeCompanyId: created.companyId, ...context });

    await deps.audit.record({
      companyId: null,
      actorUserId: created.userId,
      action: AUTH_AUDIT_ACTIONS.accountRegistered,
      metadata: { withCpf: Boolean(cpf) },
      ...auditContext(context),
    });
    await deps.audit.record({
      companyId: created.companyId,
      actorUserId: created.userId,
      action: AUTH_AUDIT_ACTIONS.companyCreated,
      entityType: "Company",
      entityId: created.companyId,
      ...auditContext(context),
    });

    return { ok: true, userId: created.userId, companyId: created.companyId, session };
  };
}

export type RegisterUseCase = ReturnType<typeof createRegisterUseCase>;
