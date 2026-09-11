import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { isSameOriginRequest, readJsonBody, requestContext } from "@/infrastructure/http/request-security";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { setSessionCookie } from "@/infrastructure/http/session-cookie";

/**
 * Cadastro pelo link do convite: cria a conta com o e-mail do convite, já como
 * membro da empresa que convidou (sem criar empresa nova), e inicia a sessão.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.status, body.error);

  const { token } = await params;
  const result = await getAuthServices().members.signupWithInvitation(token, body.data, requestContext(request));

  if (result.ok) {
    await setSessionCookie(APP_URL, result.session.token, result.session.absoluteExpiresAt);
    return jsonResponse({ userId: result.userId, companyId: result.companyId }, 201);
  }
  if (result.reason === "rate_limited") {
    return errorResponse(429, "rate_limited", {}, { "Retry-After": String(result.retryAfterSeconds) });
  }
  return memberFailureResponse(result);
}
