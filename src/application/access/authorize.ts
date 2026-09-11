import type { SessionManager } from "@/application/auth/session-manager";
import type { AccessControlRepository, EntitlementService } from "@/application/ports/access-control";
import type { IdentityRepository } from "@/application/ports/identity-repository";
import type { MfaRepository } from "@/application/ports/mfa";
import { requiresMfa } from "@/domain/access-control/mfa-policy";
import { bypassesSubscription, moduleOfPermission } from "@/domain/access-control/permission-modules";
import type { CatalogPermission } from "@/domain/access-control/system-roles";
import type { TenantContext } from "@/domain/shared/tenant-context";

/** Contexto de uma requisição autorizada: a empresa vem SEMPRE da sessão. */
export interface AuthorizedContext extends TenantContext {
  readonly roleKeys: readonly string[];
  readonly permissions: readonly string[];
}

export type AuthorizationFailure =
  | "unauthenticated"
  | "active_company_required"
  | "forbidden"
  | "module_not_enabled"
  | "subscription_inactive"
  | "mfa_enrollment_required"
  | "mfa_required";

export type AuthorizationResult =
  | { readonly ok: true; readonly context: AuthorizedContext }
  | { readonly ok: false; readonly reason: AuthorizationFailure };

/**
 * Cadeia de autorização do MASTER SPEC:
 * sessão → pessoa ativa → empresa ativa → vínculo ativo em empresa ativa →
 * segundo fator (quando o perfil exige) → permissão do perfil → entitlement
 * (assinatura válida e módulo ativo). A verificação do recurso fica na
 * consulta, sempre filtrada por `context.companyId`.
 */
export function createAuthorizer(deps: {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly access: AccessControlRepository;
  readonly entitlements: EntitlementService;
  readonly mfa: MfaRepository;
}) {
  return async function authorize(
    token: string | undefined,
    permission: CatalogPermission,
  ): Promise<AuthorizationResult> {
    const session = await deps.sessions.validate(token);
    if (!session) return { ok: false, reason: "unauthenticated" };

    const user = await deps.identity.findActiveProfile(session.userId);
    if (!user) return { ok: false, reason: "unauthenticated" };

    const companyId = session.activeCompanyId;
    if (!companyId) return { ok: false, reason: "active_company_required" };

    const access = await deps.access.findMembershipAccess(user.id, companyId);
    if (!access || access.membershipStatus !== "ACTIVE" || !access.companyActive) {
      return { ok: false, reason: "forbidden" };
    }

    if (requiresMfa(access.roleKeys)) {
      const credential = await deps.mfa.findCredential(user.id);
      if (!credential?.confirmed) return { ok: false, reason: "mfa_enrollment_required" };
      if (!session.mfaVerifiedAt) return { ok: false, reason: "mfa_required" };
    }

    if (!access.permissions.includes(permission)) return { ok: false, reason: "forbidden" };

    // Assinatura inválida bloqueia tudo, Core incluído (DEC-022) — exceto as
    // permissões de assinatura, que são o caminho para assinar ou reativar.
    if (!bypassesSubscription(permission)) {
      const entitlement = await deps.entitlements.checkModule(companyId, moduleOfPermission(permission));
      if (entitlement !== "enabled") return { ok: false, reason: entitlement };
    }

    return {
      ok: true,
      context: { companyId, userId: user.id, roleKeys: access.roleKeys, permissions: access.permissions },
    };
  };
}

export type Authorizer = ReturnType<typeof createAuthorizer>;
