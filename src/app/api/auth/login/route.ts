import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { isSameOriginRequest, readJsonBody, requestContext } from "@/infrastructure/http/request-security";
import { setSessionCookie } from "@/infrastructure/http/session-cookie";

export async function POST(request: Request) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.status, body.error);

  const result = await getAuthServices().login(body.data, requestContext(request));

  if (result.ok) {
    await setSessionCookie(APP_URL, result.session.token, result.session.absoluteExpiresAt);
    return jsonResponse({ userId: result.userId, activeCompanyId: result.session.activeCompanyId });
  }

  switch (result.reason) {
    case "invalid_input":
      return errorResponse(400, "invalid_input");
    case "invalid_credentials":
      return errorResponse(401, "invalid_credentials", { message: "E-mail, CPF ou senha incorretos." });
    case "rate_limited":
      return errorResponse(429, "rate_limited", {}, { "Retry-After": String(result.retryAfterSeconds) });
  }
}
