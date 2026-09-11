import { z } from "zod";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository, UserCredentials } from "@/application/ports/identity-repository";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { SensitiveDataProtector } from "@/application/ports/security-tokens";
import { type LoginIdentifier, parseLoginIdentifier } from "@/domain/identity/login-identifier";
import type { IssuedSession, SessionManager } from "./session-manager";
import {
  AUTH_AUDIT_ACTIONS,
  AUTH_RATE_LIMITS,
  auditContext,
  ipRateLimitKey,
  type RequestContext,
  retryAfterSeconds,
} from "./shared";

export const loginInputSchema = z.object({
  identifier: z.string().min(1).max(320),
  password: z.string().min(1).max(1024),
});

export type LoginResult =
  | { readonly ok: true; readonly userId: string; readonly session: IssuedSession }
  | { readonly ok: false; readonly reason: "invalid_input" | "invalid_credentials" }
  | { readonly ok: false; readonly reason: "rate_limited"; readonly retryAfterSeconds: number };

export interface LoginDependencies {
  readonly identity: IdentityRepository;
  readonly hasher: PasswordHasher;
  readonly protector: SensitiveDataProtector;
  readonly sessions: SessionManager;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}

/** Usada apenas para gastar o mesmo tempo de verificação quando a conta não existe. */
const TIMING_EQUALIZER_PASSWORD = "veldocs:timing-equalizer";

const methodOf = (identifier: LoginIdentifier | null) =>
  identifier?.kind === "cpf" ? "password_cpf" : identifier?.kind === "email" ? "password_email" : "password_unknown";

/**
 * Login por e-mail ou CPF + senha.
 * - Resposta idêntica para conta inexistente, senha errada ou conta desativada.
 * - Tempo de resposta equalizado com uma verificação Argon2 fictícia.
 * - Limite de tentativas por IP e por conta (identificador em HMAC).
 */
export function createLoginUseCase(deps: LoginDependencies) {
  let equalizerHash: Promise<string> | undefined;

  const spendVerificationTime = async (password: string) => {
    equalizerHash ??= deps.hasher.hash(TIMING_EQUALIZER_PASSWORD);
    await deps.hasher.verify(await equalizerHash, password);
  };

  const findCredentials = (identifier: LoginIdentifier): Promise<UserCredentials | null> =>
    identifier.kind === "email"
      ? deps.identity.findCredentialsByEmail(identifier.email)
      : deps.identity.findCredentialsByCpfLookupHash(deps.protector.lookupHash("cpf", identifier.cpf));

  return async function login(rawInput: unknown, context: RequestContext): Promise<LoginResult> {
    const input = loginInputSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, reason: "invalid_input" };

    const { password } = input.data;
    const identifier = parseLoginIdentifier(input.data.identifier);
    const accountSubject = identifier
      ? identifier.kind === "email"
        ? `email:${identifier.email}`
        : `cpf:${identifier.cpf}`
      : `raw:${input.data.identifier.trim().toLowerCase()}`;

    const limits = await Promise.all([
      deps.rateLimiter.consume(ipRateLimitKey("auth:login", context), AUTH_RATE_LIMITS.loginPerIp),
      deps.rateLimiter.consume(
        `auth:login:account:${deps.protector.lookupHash("rate-limit", accountSubject)}`,
        AUTH_RATE_LIMITS.loginPerAccount,
      ),
    ]);

    if (limits.some((limit) => !limit.allowed)) {
      await deps.audit.record({
        companyId: null,
        actorUserId: null,
        action: AUTH_AUDIT_ACTIONS.loginRateLimited,
        metadata: { method: methodOf(identifier) },
        ...auditContext(context),
      });
      return { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfterSeconds(limits, deps.now()) };
    }

    const credentials = identifier ? await findCredentials(identifier) : null;

    let passwordMatches = false;
    if (credentials?.passwordHash) {
      passwordMatches = await deps.hasher.verify(credentials.passwordHash, password);
    } else {
      await spendVerificationTime(password);
    }

    if (!credentials || !passwordMatches || credentials.status !== "ACTIVE") {
      await deps.audit.record({
        companyId: null,
        actorUserId: credentials?.userId ?? null,
        action: AUTH_AUDIT_ACTIONS.loginFailed,
        metadata: { method: methodOf(identifier) },
        ...auditContext(context),
      });
      return { ok: false, reason: "invalid_credentials" };
    }

    const activeMemberships = (await deps.identity.listMemberships(credentials.userId)).filter(
      (membership) => membership.status === "ACTIVE",
    );
    const [onlyMembership] = activeMemberships;

    const session = await deps.sessions.issue({
      userId: credentials.userId,
      activeCompanyId: activeMemberships.length === 1 && onlyMembership ? onlyMembership.companyId : null,
      ...context,
    });

    await deps.identity.recordSuccessfulLogin(credentials.userId, deps.now());
    await deps.audit.record({
      companyId: null,
      actorUserId: credentials.userId,
      action: AUTH_AUDIT_ACTIONS.loginSucceeded,
      metadata: { method: methodOf(identifier) },
      ...auditContext(context),
    });

    return { ok: true, userId: credentials.userId, session };
  };
}

export type LoginUseCase = ReturnType<typeof createLoginUseCase>;
