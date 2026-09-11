import type { SessionManager } from "@/application/auth/session-manager";
import type { AccessControlRepository, EntitlementService } from "@/application/ports/access-control";
import type { IdentityRepository } from "@/application/ports/identity-repository";
import { moduleOfPermission } from "@/domain/access-control/permission-modules";
import type { CatalogPermission } from "@/domain/access-control/system-roles";
import type { TenantContext } from "@/domain/shared/tenant-context";

/** Contexto de uma requisição autorizada: a empresa vem SEMPRE da sessão. */
export interface AuthorizedContext extends TenantContext {
  readonly roleKeys: readonly string[];
  readonly permissions: readonly string[];
}

export type AuthorizationFailure = "unauthenticated" | "active_company_required" | "forbidden" | "module_not_enabled";

export type AuthorizationResult =
  | { readonly ok: true; readonly context: AuthorizedContext }
  | { readonly ok: false; readonly reason: AuthorizationFailure };

/**
 * Cadeia de autorização do MASTER SPEC:
 * sessão → pessoa ativa → empresa ativa → vínculo ativo em empresa ativa →
 * permissão do perfil → entitlement do módulo. A verificação do recurso fica
 * na consulta, sempre filtrada por `context.companyId`.
 */
export function createAuthorizer(deps: {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly access: AccessControlRepository;
  readonly entitlements: EntitlementService;
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

    if (!access.permissions.includes(permission)) return { ok: false, reason: "forbidden" };

    if (!(await deps.entitlements.isModuleEnabled(companyId, moduleOfPermission(permission)))) {
      return { ok: false, reason: "module_not_enabled" };
    }

    return {
      ok: true,
      context: { companyId, userId: user.id, roleKeys: access.roleKeys, permissions: access.permissions },
    };
  };
}

export type Authorizer = ReturnType<typeof createAuthorizer>;
