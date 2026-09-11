import type { AccessControlRepository } from "@/application/ports/access-control";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository, MembershipSummary, UserProfile } from "@/application/ports/identity-repository";
import type { MfaRepository } from "@/application/ports/mfa";
import { requiresMfa } from "@/domain/access-control/mfa-policy";
import type { SessionManager, ValidSession } from "./session-manager";
import { AUTH_AUDIT_ACTIONS, auditContext, type RequestContext } from "./shared";

export interface MfaStatus {
  /** O perfil na empresa ativa exige segundo fator. */
  readonly required: boolean;
  /** A pessoa já confirmou o cadastro do app autenticador. */
  readonly configured: boolean;
  /** O segundo fator já foi confirmado nesta sessão. */
  readonly verified: boolean;
}

export interface CurrentSession {
  readonly session: ValidSession;
  readonly user: UserProfile;
  readonly memberships: readonly MembershipSummary[];
  readonly mfa: MfaStatus;
}

export function createSessionUseCases(deps: {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly access: AccessControlRepository;
  readonly mfa: MfaRepository;
  readonly audit: AuditLogger;
}) {
  return {
    /** Sessão válida de uma pessoa ativa, com vínculos e estado do segundo fator. */
    async getCurrentSession(token: string | undefined): Promise<CurrentSession | null> {
      const session = await deps.sessions.validate(token);
      if (!session) return null;

      const user = await deps.identity.findActiveProfile(session.userId);
      if (!user) return null;

      const [memberships, credential, activeAccess] = await Promise.all([
        deps.identity.listMemberships(user.id),
        deps.mfa.findCredential(user.id),
        session.activeCompanyId ? deps.access.findMembershipAccess(user.id, session.activeCompanyId) : null,
      ]);

      return {
        session,
        user,
        memberships,
        mfa: {
          required: activeAccess ? requiresMfa(activeAccess.roleKeys) : false,
          configured: credential?.confirmed ?? false,
          verified: session.mfaVerifiedAt !== null,
        },
      };
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
