import "server-only";
import type { NextResponse } from "next/server";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { WriteResult } from "@/application/access/manage-company";
import type { RequestContext } from "@/application/auth/shared";
import type { RateLimitRule } from "@/application/ports/rate-limiter";
import type { CatalogPermission } from "@/domain/access-control/system-roles";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { authorizeRequest } from "./authorization";
import { enforceRequestRateLimit } from "./request-rate-limit";
import { isSameOriginRequest, readJsonBody, requestContext } from "./request-security";
import { errorResponse, jsonResponse } from "./responses";

/** Escritas são mais caras e mais sensíveis que leituras: limite menor. */
export const WRITE_RATE_LIMIT: RateLimitRule = { limit: 30, windowMs: 60_000 };

export interface PreparedWrite {
  readonly context: AuthorizedContext;
  /** Corpo JSON bruto; a validação é do caso de uso. `undefined` sem corpo. */
  readonly body: unknown;
  readonly request: RequestContext;
}

/**
 * Passos obrigatórios de toda rota de escrita, na ordem: origem (CSRF) →
 * limite por IP → autorização → corpo JSON. Devolve a resposta de recusa ou o
 * contexto autorizado para o caso de uso.
 */
export async function prepareWrite(
  request: Request,
  permission: CatalogPermission,
  options: { readonly body?: boolean } = {},
): Promise<{ ok: true; prepared: PreparedWrite } | { ok: false; response: NextResponse }> {
  if (!isSameOriginRequest(request, getEnv().APP_URL)) {
    return { ok: false, response: errorResponse(403, "forbidden_origin") };
  }

  const limited = await enforceRequestRateLimit(request, getAuthServices().rateLimiter, {
    scope: "api:write",
    rule: WRITE_RATE_LIMIT,
  });
  if (limited) return { ok: false, response: limited };

  const authorization = await authorizeRequest(permission, request);
  if (!authorization.ok) return authorization;

  let body: unknown;
  if (options.body !== false) {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { ok: false, response: errorResponse(parsed.status, parsed.error) };
    body = parsed.data;
  }

  return { ok: true, prepared: { context: authorization.context, body, request: requestContext(request) } };
}

const FAILURES = {
  not_found: { status: 404, error: "not_found", message: "Registro não encontrado." },
  conflict: { status: 409, error: "conflict", message: "Já existe um registro com estes dados." },
  in_use: { status: 409, error: "resource_in_use", message: "Este registro ainda está em uso e não pode ser excluído." },
} as const;

/** Traduz a recusa do caso de uso para HTTP, sem vazar detalhes internos. */
export function writeFailureResponse(result: Extract<WriteResult<unknown>, { ok: false }>): NextResponse {
  if (result.reason === "invalid_input") {
    return errorResponse(400, "invalid_input", { issues: result.issues ?? [] });
  }
  const { status, error, message } = FAILURES[result.reason];
  return errorResponse(status, error, { message });
}

/** Resposta de sucesso de uma escrita, ou a recusa correspondente. */
export function writeResponse<T>(result: WriteResult<T>, body: (data: T) => unknown, status = 200): NextResponse {
  return result.ok ? jsonResponse(body(result.data), status) : writeFailureResponse(result);
}
