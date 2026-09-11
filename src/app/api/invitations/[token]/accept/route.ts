import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { isSameOriginRequest, requestContext } from "@/infrastructure/http/request-security";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { WRITE_RATE_LIMIT } from "@/infrastructure/http/write-route";

/** Quem já tem conta aceita o convite com a sessão atual; a empresa do convite vira a ativa. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const services = getAuthServices();
  const limited = await enforceRequestRateLimit(request, services.rateLimiter, {
    scope: "api:invitation-accept",
    rule: WRITE_RATE_LIMIT,
  });
  if (limited) return limited;

  const { token } = await params;
  const result = await services.members.acceptInvitation(token, await readSessionToken(APP_URL), requestContext(request));
  return result.ok ? jsonResponse({ companyId: result.companyId }) : memberFailureResponse(result);
}
