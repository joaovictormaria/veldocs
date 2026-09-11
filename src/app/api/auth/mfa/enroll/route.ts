import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { authorizationFailureResponse } from "@/infrastructure/http/authorization-responses";
import { isSameOriginRequest, requestContext } from "@/infrastructure/http/request-security";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { readSessionToken } from "@/infrastructure/http/session-cookie";

/** Inicia o cadastro do app autenticador: devolve o segredo e o URI do QR Code. */
export async function POST(request: Request) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const result = await getAuthServices().mfa.start(await readSessionToken(APP_URL), requestContext(request));

  if (result.ok) return jsonResponse({ secret: result.secret, keyUri: result.keyUri });

  switch (result.reason) {
    case "unauthenticated":
      return authorizationFailureResponse("unauthenticated");
    case "already_enabled":
      return errorResponse(409, "mfa_already_enabled", {
        message: "A verificação em duas etapas já está ativa nesta conta.",
      });
  }
}
