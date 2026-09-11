import "server-only";
import type { NextResponse } from "next/server";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { CatalogPermission } from "@/domain/access-control/system-roles";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { getLogger, requestId } from "@/infrastructure/observability/logger";
import { authorizationFailureResponse } from "./authorization-responses";
import { readSessionToken } from "./session-cookie";

/**
 * Autoriza a requisição atual para uma permissão. Toda rota de negócio deve
 * chamar esta função antes de qualquer consulta e usar `context.companyId`
 * (nunca uma empresa vinda da requisição).
 */
export async function authorizeRequest(
  permission: CatalogPermission,
  request?: Request,
): Promise<{ ok: true; context: AuthorizedContext } | { ok: false; response: NextResponse }> {
  const { APP_URL } = getEnv();
  const result = await getAuthServices().authorize(await readSessionToken(APP_URL), permission);
  if (result.ok) return result;

  getLogger().warn("authorization_denied", {
    reason: result.reason,
    permission,
    requestId: request ? requestId(request) : undefined,
    path: request ? new URL(request.url).pathname : undefined,
  });

  return { ok: false, response: authorizationFailureResponse(result.reason) };
}
