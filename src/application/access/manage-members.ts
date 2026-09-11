import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue } from "@/application/access/manage-company";
import type { IssuedSession, SessionManager } from "@/application/auth/session-manager";
import {
  AccountAlreadyExistsError,
  AUTH_AUDIT_ACTIONS,
  AUTH_RATE_LIMITS,
  auditContext,
  ipRateLimitKey,
  type RequestContext,
  retryAfterSeconds,
} from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository } from "@/application/ports/identity-repository";
import {
  AlreadyMemberError,
  type InvitationRecord,
  InvitationNotAvailableError,
  LastOwnerError,
  type MemberManagementRepository,
  type RoleSummary,
} from "@/application/ports/member-management";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { SensitiveDataProtector, TokenService } from "@/application/ports/security-tokens";
import { canGrantRoles, canManageMember } from "@/domain/access-control/member-rules";
import { SYSTEM_ROLE_KEYS } from "@/domain/access-control/system-roles";
import { cpfSchema } from "@/domain/identity/cpf";
import { emailSchema } from "@/domain/identity/email";
import { invitationExpiresAt, maskEmail } from "@/domain/identity/invitation";
import { passwordSchema } from "@/domain/identity/password-policy";

export const MEMBER_AUDIT_ACTIONS = {
  invited: "member.invited",
  invitationRevoked: "invitation.revoked",
  invitationAccepted: "invitation.accepted",
  rolesChanged: "member.roles_changed",
  suspended: "member.suspended",
  reactivated: "member.reactivated",
  removed: "member.removed",
} as const;

const roleKeySchema = z.string().trim().min(1, { error: "informe o perfil" }).max(64);

export const inviteInputSchema = z.object({ email: emailSchema, roleKey: roleKeySchema });

export const memberRolesInputSchema = z.object({
  roleKeys: z
    .array(roleKeySchema)
    .min(1, { error: "informe pelo menos um perfil" })
    .max(SYSTEM_ROLE_KEYS.length),
});

export const memberStatusInputSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export const invitationSignupInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe seu nome" }).max(200),
  password: passwordSchema,
  cpf: z.union([z.literal("").transform(() => undefined), cpfSchema]).optional(),
});

/** O que quem abre o link pode ver. */
export interface InvitationPublicView {
  readonly companyName: string;
  readonly email: string;
  readonly roleName: string;
  readonly expiresAt: Date;
}

type Invalid = { readonly ok: false; readonly reason: "invalid_input"; readonly issues: readonly ValidationIssue[] };

export type MemberWriteResult =
  | { readonly ok: true }
  | Invalid
  | { readonly ok: false; readonly reason: "not_found" | "cannot_modify_self" | "role_not_allowed" | "last_owner" };

export type InviteResult =
  | { readonly ok: true; readonly invitation: InvitationRecord; readonly token: string }
  | Invalid
  | { readonly ok: false; readonly reason: "role_not_allowed" | "already_member" };

export type AcceptInvitationResult =
  | { readonly ok: true; readonly companyId: string }
  | {
      readonly ok: false;
      readonly reason: "unauthenticated" | "invitation_not_available" | "email_mismatch" | "already_member";
    };

export type InvitationSignupResult =
  | { readonly ok: true; readonly userId: string; readonly companyId: string; readonly session: IssuedSession }
  | Invalid
  | { readonly ok: false; readonly reason: "invitation_not_available" | "account_exists" }
  | { readonly ok: false; readonly reason: "rate_limited"; readonly retryAfterSeconds: number };

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const invalid = (issues: readonly ValidationIssue[]): Invalid => ({ ok: false, reason: "invalid_input", issues });

/**
 * Membros, perfis e convites da empresa ativa (FASE 3).
 *
 * Regras: ninguém altera o próprio vínculo; só Proprietário concede, altera ou
 * remove Proprietário; a empresa nunca fica sem Proprietário ativo. Convites
 * vão por link (sem e-mail transacional por enquanto) e valem 7 dias, uma vez.
 */
export function createMemberManagement(deps: {
  readonly repository: MemberManagementRepository;
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly tokens: TokenService;
  readonly hasher: PasswordHasher;
  readonly protector: SensitiveDataProtector;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  const record = (
    companyId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    request: RequestContext,
    metadata?: Record<string, string | number | boolean | null>,
  ) =>
    deps.audit.record({
      companyId,
      actorUserId,
      action,
      entityType,
      entityId,
      ...(metadata ? { metadata } : {}),
      ...auditContext(request),
    });

  const pendingInvitation = async (token: string) => {
    if (!deps.tokens.isWellFormed(token)) return null;
    const invitation = await deps.repository.findPendingInvitation(deps.tokens.hash(token), deps.now());
    return invitation?.companyActive ? invitation : null;
  };

  /** Alvo de uma alteração: não é a própria pessoa, existe e o autor pode gerenciá-lo. */
  const loadTarget = async (context: AuthorizedContext, userId: string) => {
    if (userId === context.userId) return { ok: false, reason: "cannot_modify_self" } as const;
    const state = await deps.repository.findMemberState(context.companyId, userId);
    if (!state || state.status === "REMOVED") return { ok: false, reason: "not_found" } as const;
    if (!canManageMember(context.roleKeys, state.roleKeys)) return { ok: false, reason: "role_not_allowed" } as const;
    return { ok: true, state } as const;
  };

  return {
    listRoles: (context: AuthorizedContext): Promise<RoleSummary[]> => deps.repository.listRoles(context.companyId),

    listInvitations: (context: AuthorizedContext): Promise<InvitationRecord[]> =>
      deps.repository.listPendingInvitations(context.companyId, deps.now()),

    async invite(context: AuthorizedContext, rawInput: unknown, request: RequestContext): Promise<InviteResult> {
      const input = inviteInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const [role] = await deps.repository.findRoles(context.companyId, [input.data.roleKey]);
      if (!role) return invalid([{ field: "roleKey", message: "perfil inexistente" }]);
      if (!canGrantRoles(context.roleKeys, [role.key])) return { ok: false, reason: "role_not_allowed" };
      if (await deps.repository.isMemberByEmail(context.companyId, input.data.email)) {
        return { ok: false, reason: "already_member" };
      }

      const at = deps.now();
      const token = deps.tokens.generate();
      const invitation = await deps.repository.createInvitation({
        companyId: context.companyId,
        email: input.data.email,
        roleId: role.id,
        tokenHash: deps.tokens.hash(token),
        invitedByUserId: context.userId,
        expiresAt: invitationExpiresAt(at),
        at,
      });

      // O e-mail convidado não vai para a auditoria (dado digitado por terceiro).
      await record(context.companyId, context.userId, MEMBER_AUDIT_ACTIONS.invited, "CompanyInvitation", invitation.id, request, {
        roleKey: role.key,
      });
      return { ok: true, invitation, token };
    },

    async revokeInvitation(
      context: AuthorizedContext,
      invitationId: string,
      request: RequestContext,
    ): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: "not_found" }> {
      const revoked = await deps.repository.revokeInvitation(context.companyId, invitationId, deps.now());
      if (!revoked) return { ok: false, reason: "not_found" };
      await record(
        context.companyId,
        context.userId,
        MEMBER_AUDIT_ACTIONS.invitationRevoked,
        "CompanyInvitation",
        invitationId,
        request,
      );
      return { ok: true };
    },

    async previewInvitation(token: string): Promise<InvitationPublicView | null> {
      const invitation = await pendingInvitation(token);
      if (!invitation) return null;
      return {
        companyName: invitation.companyName,
        email: maskEmail(invitation.email),
        roleName: invitation.roleName,
        expiresAt: invitation.expiresAt,
      };
    },

    /** Quem já tem conta aceita com a própria sessão; o e-mail precisa ser o do convite. */
    async acceptInvitation(
      token: string,
      sessionToken: string | undefined,
      request: RequestContext,
    ): Promise<AcceptInvitationResult> {
      const session = await deps.sessions.validate(sessionToken);
      const user = session ? await deps.identity.findActiveProfile(session.userId) : null;
      if (!user) return { ok: false, reason: "unauthenticated" };

      const invitation = await pendingInvitation(token);
      if (!invitation) return { ok: false, reason: "invitation_not_available" };
      if (invitation.email !== user.email.toLowerCase()) return { ok: false, reason: "email_mismatch" };

      try {
        await deps.repository.acceptInvitation({
          invitationId: invitation.id,
          companyId: invitation.companyId,
          userId: user.id,
          roleId: invitation.roleId,
          at: deps.now(),
        });
      } catch (error) {
        if (error instanceof InvitationNotAvailableError) return { ok: false, reason: "invitation_not_available" };
        if (error instanceof AlreadyMemberError) return { ok: false, reason: "already_member" };
        throw error;
      }

      await deps.sessions.setActiveCompany(sessionToken, invitation.companyId);
      await record(invitation.companyId, user.id, MEMBER_AUDIT_ACTIONS.invitationAccepted, "CompanyInvitation", invitation.id, request, {
        roleKey: invitation.roleKey,
        newAccount: false,
      });
      return { ok: true, companyId: invitation.companyId };
    },

    /** Quem ainda não tem conta se cadastra pelo link e entra direto na empresa, sem criar outra. */
    async signupWithInvitation(token: string, rawInput: unknown, request: RequestContext): Promise<InvitationSignupResult> {
      const limit = await deps.rateLimiter.consume(ipRateLimitKey("auth:register", request), AUTH_RATE_LIMITS.registerPerIp);
      if (!limit.allowed) {
        return { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfterSeconds([limit], deps.now()) };
      }

      const input = invitationSignupInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const invitation = await pendingInvitation(token);
      if (!invitation) return { ok: false, reason: "invitation_not_available" };

      const { name, password, cpf } = input.data;
      let created: { userId: string };
      try {
        created = await deps.repository.createAccountFromInvitation({
          invitationId: invitation.id,
          companyId: invitation.companyId,
          roleId: invitation.roleId,
          name,
          email: invitation.email,
          passwordHash: await deps.hasher.hash(password),
          cpf: cpf ? { lookupHash: deps.protector.lookupHash("cpf", cpf), encrypted: deps.protector.encryptCpf(cpf) } : null,
          at: deps.now(),
        });
      } catch (error) {
        if (error instanceof InvitationNotAvailableError) return { ok: false, reason: "invitation_not_available" };
        if (error instanceof AccountAlreadyExistsError) return { ok: false, reason: "account_exists" };
        throw error;
      }

      const session = await deps.sessions.issue({
        userId: created.userId,
        activeCompanyId: invitation.companyId,
        ...request,
      });

      await deps.audit.record({
        companyId: null,
        actorUserId: created.userId,
        action: AUTH_AUDIT_ACTIONS.accountRegistered,
        metadata: { withCpf: Boolean(cpf), viaInvitation: true },
        ...auditContext(request),
      });
      await record(invitation.companyId, created.userId, MEMBER_AUDIT_ACTIONS.invitationAccepted, "CompanyInvitation", invitation.id, request, {
        roleKey: invitation.roleKey,
        newAccount: true,
      });

      return { ok: true, userId: created.userId, companyId: invitation.companyId, session };
    },

    async changeRoles(
      context: AuthorizedContext,
      userId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<MemberWriteResult> {
      const input = memberRolesInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));
      const roleKeys = [...new Set(input.data.roleKeys)].sort();

      const target = await loadTarget(context, userId);
      if (!target.ok) return target;

      const roles = await deps.repository.findRoles(context.companyId, roleKeys);
      if (roles.length !== roleKeys.length) return invalid([{ field: "roleKeys", message: "perfil inexistente" }]);
      if (!canGrantRoles(context.roleKeys, roleKeys)) return { ok: false, reason: "role_not_allowed" };

      try {
        await deps.repository.replaceMemberRoles(
          context.companyId,
          userId,
          roles.map((role) => role.id),
        );
      } catch (error) {
        if (error instanceof LastOwnerError) return { ok: false, reason: "last_owner" };
        throw error;
      }

      await record(context.companyId, context.userId, MEMBER_AUDIT_ACTIONS.rolesChanged, "Membership", userId, request, {
        roleKeys: roleKeys.join(","),
      });
      return { ok: true };
    },

    async setStatus(
      context: AuthorizedContext,
      userId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<MemberWriteResult> {
      const input = memberStatusInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const target = await loadTarget(context, userId);
      if (!target.ok) return target;
      if (target.state.status === input.data.status) return { ok: true };

      try {
        await deps.repository.setMemberStatus(context.companyId, userId, input.data.status);
      } catch (error) {
        if (error instanceof LastOwnerError) return { ok: false, reason: "last_owner" };
        throw error;
      }

      const action = input.data.status === "SUSPENDED" ? MEMBER_AUDIT_ACTIONS.suspended : MEMBER_AUDIT_ACTIONS.reactivated;
      await record(context.companyId, context.userId, action, "Membership", userId, request, { from: target.state.status });
      return { ok: true };
    },

    /** Remove da empresa sem apagar o vínculo: o histórico continua ligado a ele. */
    async remove(context: AuthorizedContext, userId: string, request: RequestContext): Promise<MemberWriteResult> {
      const target = await loadTarget(context, userId);
      if (!target.ok) return target;

      try {
        await deps.repository.setMemberStatus(context.companyId, userId, "REMOVED");
      } catch (error) {
        if (error instanceof LastOwnerError) return { ok: false, reason: "last_owner" };
        throw error;
      }

      await record(context.companyId, context.userId, MEMBER_AUDIT_ACTIONS.removed, "Membership", userId, request);
      return { ok: true };
    },
  };
}

export type MemberManagement = ReturnType<typeof createMemberManagement>;
