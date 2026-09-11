import type { SessionRepository, StoredSession } from "@/application/ports/session-repository";
import type { TokenService } from "@/application/ports/security-tokens";
import type { RequestContext } from "./shared";

const DAY = 24 * 60 * 60 * 1000;

export interface SessionPolicy {
  /** Expira após este tempo sem uso. */
  readonly idleTimeoutMs: number;
  /** Nunca ultrapassa este tempo desde o login. */
  readonly absoluteTimeoutMs: number;
}

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  idleTimeoutMs: 7 * DAY,
  absoluteTimeoutMs: 30 * DAY,
};

export interface IssuedSession {
  /** Valor para o cookie. Nunca registrar em logs. */
  readonly token: string;
  readonly activeCompanyId: string | null;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface ValidSession {
  readonly userId: string;
  readonly activeCompanyId: string | null;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly mfaVerifiedAt: Date | null;
}

export interface SessionManager {
  /** Sempre cria uma sessão nova (evita session fixation). */
  issue(input: { userId: string; activeCompanyId: string | null } & RequestContext): Promise<IssuedSession>;
  validate(token: string | undefined): Promise<ValidSession | null>;
  /** Troca a empresa ativa de uma sessão válida (o vínculo deve ser verificado antes). */
  setActiveCompany(token: string | undefined, companyId: string): Promise<ValidSession | null>;
  /** Registra a confirmação do segundo fator na sessão. */
  setMfaVerified(token: string | undefined, at: Date): Promise<ValidSession | null>;
  /** Revoga a sessão do token, se existir e estiver ativa. */
  revoke(token: string | undefined): Promise<ValidSession | null>;
  revokeAllForUser(userId: string): Promise<number>;
}

export function createSessionManager(deps: {
  readonly sessions: SessionRepository;
  readonly tokens: TokenService;
  readonly now: () => Date;
  readonly policy?: SessionPolicy;
}): SessionManager {
  const policy = deps.policy ?? DEFAULT_SESSION_POLICY;

  const cappedIdleExpiry = (now: Date, absoluteExpiresAt: Date) =>
    new Date(Math.min(now.getTime() + policy.idleTimeoutMs, absoluteExpiresAt.getTime()));

  const findActive = async (token: string | undefined): Promise<StoredSession | null> => {
    if (!token || !deps.tokens.isWellFormed(token)) return null;
    const session = await deps.sessions.findById(deps.tokens.hash(token));
    const now = deps.now().getTime();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
      return null;
    }
    return session;
  };

  const toValid = (session: StoredSession, expiresAt = session.expiresAt): ValidSession => ({
    userId: session.userId,
    activeCompanyId: session.activeCompanyId,
    expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    mfaVerifiedAt: session.mfaVerifiedAt,
  });

  return {
    async issue({ userId, activeCompanyId, ipAddress, userAgent }) {
      const now = deps.now();
      const token = deps.tokens.generate();
      const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteTimeoutMs);
      const expiresAt = cappedIdleExpiry(now, absoluteExpiresAt);

      await deps.sessions.create({
        id: deps.tokens.hash(token),
        userId,
        activeCompanyId,
        createdAt: now,
        expiresAt,
        absoluteExpiresAt,
        ipAddress,
        userAgent,
      });

      return { token, activeCompanyId, expiresAt, absoluteExpiresAt };
    },

    async validate(token) {
      const session = await findActive(token);
      if (!session) return null;

      // Renova por uso quando já passou metade da janela de inatividade.
      const now = deps.now();
      if (session.expiresAt.getTime() - now.getTime() < policy.idleTimeoutMs / 2) {
        const expiresAt = cappedIdleExpiry(now, session.absoluteExpiresAt);
        await deps.sessions.extend(session.id, expiresAt, now);
        return toValid(session, expiresAt);
      }
      return toValid(session);
    },

    async setActiveCompany(token, companyId) {
      const session = await findActive(token);
      if (!session) return null;
      await deps.sessions.setActiveCompany(session.id, companyId);
      return { ...toValid(session), activeCompanyId: companyId };
    },

    async setMfaVerified(token, at) {
      const session = await findActive(token);
      if (!session) return null;
      await deps.sessions.setMfaVerified(session.id, at);
      return { ...toValid(session), mfaVerifiedAt: at };
    },

    async revoke(token) {
      const session = await findActive(token);
      if (!session) return null;
      await deps.sessions.revoke(session.id, deps.now());
      return toValid(session);
    },

    revokeAllForUser(userId) {
      return deps.sessions.revokeAllForUser(userId, deps.now());
    },
  };
}
