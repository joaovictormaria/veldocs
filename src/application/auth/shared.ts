import type { AuditEvent } from "@/application/ports/audit-logger";
import type { RateLimitResult, RateLimitRule } from "@/application/ports/rate-limiter";

/** Dados da requisição relevantes para segurança e auditoria. */
export interface RequestContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export class AccountAlreadyExistsError extends Error {
  constructor() {
    super("já existe uma conta com estes dados");
    this.name = "AccountAlreadyExistsError";
  }
}

const MINUTE = 60_000;

export const AUTH_RATE_LIMITS = {
  loginPerIp: { limit: 30, windowMs: 15 * MINUTE },
  loginPerAccount: { limit: 10, windowMs: 15 * MINUTE },
  registerPerIp: { limit: 10, windowMs: 60 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export const AUTH_AUDIT_ACTIONS = {
  loginSucceeded: "auth.login_succeeded",
  loginFailed: "auth.login_failed",
  loginRateLimited: "auth.login_rate_limited",
  accountRegistered: "auth.account_registered",
  registerRateLimited: "auth.register_rate_limited",
  companyCreated: "company.created",
  logout: "auth.logout",
  logoutAll: "auth.logout_all",
} as const;

export function ipRateLimitKey(scope: string, context: RequestContext): string {
  return `${scope}:ip:${context.ipAddress ?? "unknown"}`;
}

export function retryAfterSeconds(results: readonly RateLimitResult[], now: Date): number {
  const blockedUntil = Math.max(...results.filter((result) => !result.allowed).map((result) => result.resetAt.getTime()));
  return Math.max(1, Math.ceil((blockedUntil - now.getTime()) / 1000));
}

export function auditContext(context: RequestContext): Pick<AuditEvent, "ipAddress" | "userAgent"> {
  return { ipAddress: context.ipAddress, userAgent: context.userAgent };
}
