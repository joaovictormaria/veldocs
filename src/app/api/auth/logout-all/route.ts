import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { errorResponse, noContentResponse } from "@/infrastructure/http/responses";
import { isSameOriginRequest, requestContext } from "@/infrastructure/http/request-security";
import { clearSessionCookie, readSessionToken } from "@/infrastructure/http/session-cookie";

export async function POST(request: Request) {
  const { APP_URL } = getEnv();
  if (!isSameOriginRequest(request, APP_URL)) return errorResponse(403, "forbidden_origin");

  const revoked = await getAuthServices().logoutAll(await readSessionToken(APP_URL), requestContext(request));
  await clearSessionCookie(APP_URL);
  return revoked ? noContentResponse() : errorResponse(401, "unauthenticated");
}
