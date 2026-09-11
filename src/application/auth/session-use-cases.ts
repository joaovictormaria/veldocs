import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository, MembershipSummary, UserProfile } from "@/application/ports/identity-repository";
import type { SessionManager, ValidSession } from "./session-manager";
import { AUTH_AUDIT_ACTIONS, auditContext, type RequestContext } from "./shared";

export interface CurrentSession {
  readonly session: ValidSession;
  readonly user: UserProfile;
  readonly memberships: readonly MembershipSummary[];
}

export function createSessionUseCases(deps: {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly audit: AuditLogger;
}) {
  return {
    /** Sessão válida de uma pessoa ativa, com seus vínculos; `null` caso contrário. */
    async getCurrentSession(token: string | undefined): Promise<CurrentSession | null> {
      const session = await deps.sessions.validate(token);
      if (!session) return null;

      const user = await deps.identity.findActiveProfile(session.userId);
      if (!user) return null;

      return { session, user, memberships: await deps.identity.listMemberships(user.id) };
    },

    async logout(token: string | undefined, context: RequestContext): Promise<void> {
      const revoked = await deps.sessions.revoke(token);
      if (!revoked) return;

      await deps.audit.record({
        companyId: null,
        actorUserId: revoked.userId,
        action: AUTH_AUDIT_ACTIONS.logout,
        ...auditContext(context),
      });
    },

    /** Encerra todas as sessões da pessoa (exige sessão válida). */
    async logoutAll(token: string | undefined, context: RequestContext): Promise<boolean> {
      const session = await deps.sessions.validate(token);
      if (!session) return false;

      const revokedSessions = await deps.sessions.revokeAllForUser(session.userId);
      await deps.audit.record({
        companyId: null,
        actorUserId: session.userId,
        action: AUTH_AUDIT_ACTIONS.logoutAll,
        metadata: { revokedSessions },
        ...auditContext(context),
      });
      return true;
    },
  };
}

export type SessionUseCases = ReturnType<typeof createSessionUseCases>;
