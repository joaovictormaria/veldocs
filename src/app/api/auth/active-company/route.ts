import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { authorizationFailureResponse } from "@/infrastructure/http/authorization-responses";
import { isSameOriginRequest, readJsonBody, requestContext } from "@/infrastructure/http/request-security";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { readSessionToken } from "@/infrastructure/http/session-cookie";

export async function POST(request: Request) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.status, body.error);

  const result = await getAuthServices().selectActiveCompany(
    await readSessionToken(APP_URL),
    body.data,
    requestContext(request),
  );

  if (result.ok) return jsonResponse({ activeCompanyId: result.activeCompanyId });

  switch (result.reason) {
    case "unauthenticated":
      return authorizationFailureResponse("unauthenticated");
    case "invalid_input":
      return errorResponse(400, "invalid_input");
    case "company_not_available":
      return errorResponse(404, "company_not_available", { message: "Empresa não encontrada ou sem acesso." });
  }
}
