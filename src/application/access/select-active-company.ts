import { z } from "zod";
import type { SessionManager } from "@/application/auth/session-manager";
import { AUTH_AUDIT_ACTIONS, auditContext, type RequestContext } from "@/application/auth/shared";
import type { AccessControlRepository } from "@/application/ports/access-control";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { IdentityRepository } from "@/application/ports/identity-repository";

export const selectActiveCompanyInputSchema = z.object({ companyId: z.uuid() });

export type SelectActiveCompanyResult =
  | { readonly ok: true; readonly activeCompanyId: string }
  | { readonly ok: false; readonly reason: "unauthenticated" | "invalid_input" | "company_not_available" };

/**
 * Define a empresa ativa da sessão. Empresa inexistente, sem vínculo, vínculo
 * não ativo e empresa suspensa recebem a MESMA resposta (não revela quais
 * empresas existem).
 */
export function createSelectActiveCompany(deps: {
  readonly sessions: SessionManager;
  readonly identity: IdentityRepository;
  readonly access: AccessControlRepository;
  readonly audit: AuditLogger;
}) {
  return async function selectActiveCompany(
    token: string | undefined,
    rawInput: unknown,
    context: RequestContext,
  ): Promise<SelectActiveCompanyResult> {
    const session = await deps.sessions.validate(token);
    if (!session || !(await deps.identity.findActiveProfile(session.userId))) {
      return { ok: false, reason: "unauthenticated" };
    }

    const input = selectActiveCompanyInputSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, reason: "invalid_input" };

    const { companyId } = input.data;
    const access = await deps.access.findMembershipAccess(session.userId, companyId);
    if (!access || access.membershipStatus !== "ACTIVE" || !access.companyActive) {
      return { ok: false, reason: "company_not_available" };
    }

    const updated = await deps.sessions.setActiveCompany(token, companyId);
    if (!updated) return { ok: false, reason: "unauthenticated" };

    await deps.audit.record({
      companyId,
      actorUserId: session.userId,
      action: AUTH_AUDIT_ACTIONS.activeCompanySelected,
      ...auditContext(context),
    });

    return { ok: true, activeCompanyId: companyId };
  };
}
