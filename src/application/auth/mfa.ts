import { z } from "zod";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository } from "@/application/ports/identity-repository";
import type { MfaRepository, MfaService } from "@/application/ports/mfa";
import type { RateLimiter, RateLimitRule } from "@/application/ports/rate-limiter";
import type { SensitiveDataProtector } from "@/application/ports/security-tokens";
import {
  formatRecoveryCode,
  isValidRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "@/domain/identity/recovery-code";
import type { SessionManager } from "./session-manager";
import { AUTH_AUDIT_ACTIONS, auditContext, type RequestContext, retryAfterSeconds } from "./shared";

export const mfaCodeInputSchema = z.object({ code: z.string().trim().min(6).max(32) });

/** Tentativas de segundo fator por pessoa. */
export const MFA_RATE_LIMIT: RateLimitRule = { limit: 10, windowMs: 15 * 60_000 };

export type MfaStartResult =
  | { readonly ok: true; readonly secret: string; readonly keyUri: string }
  | { readonly ok: false; readonly reason: "unauthenticated" | "already_enabled" };

export type MfaConfirmResult =
  | { readonly ok: true; readonly recoveryCodes: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: "unauthenticated" | "invalid_input" | "not_started" | "already_enabled" | "invalid_code";
    }
  | { readonly ok: false; readonly reason: "rate_limited"; readonly retryAfterSeconds: number };

export type MfaVerifyResult =
  | { readonly ok: true; readonly method: "totp" | "recovery_code"; readonly remainingRecoveryCodes: number }
  | { readonly ok: false; readonly reason: "unauthenticated" | "invalid_input" | "not_configured" | "invalid_code" }
  | { readonly ok: false; readonly reason: "rate_limited"; readonly retryAfterSeconds: number };

export interface MfaDependencies {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly mfa: MfaRepository;
  readonly service: MfaService;
  readonly protector: SensitiveDataProtector;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}

/**
 * Segundo fator por app autenticador (TOTP), obrigatório para OWNER/ADMIN.
 * O segredo só vale depois de confirmado com um código; a confirmação entrega
 * os códigos de recuperação, exibidos uma única vez.
 */
export function createMfaUseCases(deps: MfaDependencies) {
  const recoveryHash = (code: string) => deps.protector.lookupHash("recovery-code", normalizeRecoveryCode(code));

  const authenticated = async (token: string | undefined) => {
    const session = await deps.sessions.validate(token);
    if (!session) return null;
    const user = await deps.identity.findActiveProfile(session.userId);
    return user ? { session, user } : null;
  };

  const limit = async (userId: string) =>
    deps.rateLimiter.consume(`auth:mfa:user:${userId}`, MFA_RATE_LIMIT);

  return {
    /** Gera um segredo novo (não confirmado) e devolve o URI para o app autenticador. */
    async start(token: string | undefined, context: RequestContext): Promise<MfaStartResult> {
      const current = await authenticated(token);
      if (!current) return { ok: false, reason: "unauthenticated" };

      const credential = await deps.mfa.findCredential(current.user.id);
      if (credential?.confirmed) return { ok: false, reason: "already_enabled" };

      const secret = deps.service.generateSecret();
      await deps.mfa.startEnrollment(current.user.id, secret);
      await deps.audit.record({
        companyId: null,
        actorUserId: current.user.id,
        action: AUTH_AUDIT_ACTIONS.mfaEnrollmentStarted,
        ...auditContext(context),
      });

      return { ok: true, secret, keyUri: deps.service.keyUri({ secret, accountName: current.user.email }) };
    },

    /** Confirma o cadastro com um código válido e entrega os códigos de recuperação. */
    async confirm(token: string | undefined, rawInput: unknown, context: RequestContext): Promise<MfaConfirmResult> {
      const current = await authenticated(token);
      if (!current) return { ok: false, reason: "unauthenticated" };

      const attempts = await limit(current.user.id);
      if (!attempts.allowed) {
        await deps.audit.record({
          companyId: null,
          actorUserId: current.user.id,
          action: AUTH_AUDIT_ACTIONS.mfaRateLimited,
          ...auditContext(context),
        });
        return { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfterSeconds([attempts], deps.now()) };
      }

      const input = mfaCodeInputSchema.safeParse(rawInput);
      if (!input.success) return { ok: false, reason: "invalid_input" };

      const state = await deps.mfa.findSecret(current.user.id);
      if (!state) return { ok: false, reason: "not_started" };
      if (state.confirmed) return { ok: false, reason: "already_enabled" };

      const now = deps.now();
      const verification = deps.service.verifyTotp({
        secret: state.secret,
        code: input.data.code,
        at: now,
        lastUsedStep: null,
      });
      if (!verification) {
        await deps.audit.record({
          companyId: null,
          actorUserId: current.user.id,
          action: AUTH_AUDIT_ACTIONS.mfaFailed,
          metadata: { stage: "enrollment" },
          ...auditContext(context),
        });
        return { ok: false, reason: "invalid_code" };
      }

      const codes = deps.service.generateRecoveryCodes(RECOVERY_CODE_COUNT);
      await deps.mfa.confirmEnrollment(current.user.id, now, verification.step);
      await deps.mfa.replaceRecoveryCodes(current.user.id, codes.map(recoveryHash));
      await deps.sessions.setMfaVerified(token, now);
      await deps.audit.record({
        companyId: null,
        actorUserId: current.user.id,
        action: AUTH_AUDIT_ACTIONS.mfaEnabled,
        metadata: { recoveryCodes: codes.length },
        ...auditContext(context),
      });

      return { ok: true, recoveryCodes: codes.map(formatRecoveryCode) };
    },

    /** Confirma o segundo fator na sessão, por código do app ou de recuperação. */
    async verify(token: string | undefined, rawInput: unknown, context: RequestContext): Promise<MfaVerifyResult> {
      const current = await authenticated(token);
      if (!current) return { ok: false, reason: "unauthenticated" };

      const attempts = await limit(current.user.id);
      if (!attempts.allowed) {
        await deps.audit.record({
          companyId: null,
          actorUserId: current.user.id,
          action: AUTH_AUDIT_ACTIONS.mfaRateLimited,
          ...auditContext(context),
        });
        return { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfterSeconds([attempts], deps.now()) };
      }

      const input = mfaCodeInputSchema.safeParse(rawInput);
      if (!input.success) return { ok: false, reason: "invalid_input" };

      const state = await deps.mfa.findSecret(current.user.id);
      if (!state?.confirmed) return { ok: false, reason: "not_configured" };

      const now = deps.now();
      const verification = deps.service.verifyTotp({
        secret: state.secret,
        code: input.data.code,
        at: now,
        lastUsedStep: state.lastUsedStep,
      });

      let method: "totp" | "recovery_code" | null = null;
      if (verification) {
        await deps.mfa.recordUsedStep(current.user.id, verification.step, now);
        method = "totp";
      } else if (isValidRecoveryCode(input.data.code)) {
        const consumed = await deps.mfa.consumeRecoveryCode(current.user.id, recoveryHash(input.data.code), now);
        if (consumed) method = "recovery_code";
      }

      if (!method) {
        await deps.audit.record({
          companyId: null,
          actorUserId: current.user.id,
          action: AUTH_AUDIT_ACTIONS.mfaFailed,
          metadata: { stage: "verification" },
          ...auditContext(context),
        });
        return { ok: false, reason: "invalid_code" };
      }

      await deps.sessions.setMfaVerified(token, now);
      const remainingRecoveryCodes = await deps.mfa.countUnusedRecoveryCodes(current.user.id);
      await deps.audit.record({
        companyId: null,
        actorUserId: current.user.id,
        action: AUTH_AUDIT_ACTIONS.mfaVerified,
        metadata: { method, remainingRecoveryCodes },
        ...auditContext(context),
      });

      return { ok: true, method, remainingRecoveryCodes };
    },
  };
}

export type MfaUseCases = ReturnType<typeof createMfaUseCases>;
