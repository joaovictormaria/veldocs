import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { authorizationFailureResponse } from "@/infrastructure/http/authorization-responses";
import { isSameOriginRequest, readJsonBody, requestContext } from "@/infrastructure/http/request-security";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { readSessionToken } from "@/infrastructure/http/session-cookie";

/** Confirma o cadastro com um código do app e entrega os códigos de recuperação (uma única vez). */
export async function POST(request: Request) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.status, body.error);

  const result = await getAuthServices().mfa.confirm(
    await readSessionToken(APP_URL),
    body.data,
    requestContext(request),
  );

  if (result.ok) return jsonResponse({ recoveryCodes: result.recoveryCodes });

  switch (result.reason) {
    case "unauthenticated":
      return authorizationFailureResponse("unauthenticated");
    case "invalid_input":
    case "invalid_code":
      return errorResponse(400, result.reason, { message: "Código inválido. Tente o código atual do aplicativo." });
    case "not_started":
      return errorResponse(409, "mfa_not_started", { message: "Inicie o cadastro do app autenticador primeiro." });
    case "already_enabled":
      return errorResponse(409, "mfa_already_enabled", {
        message: "A verificação em duas etapas já está ativa nesta conta.",
      });
    case "rate_limited":
      return errorResponse(429, "rate_limited", {}, { "Retry-After": String(result.retryAfterSeconds) });
  }
}
