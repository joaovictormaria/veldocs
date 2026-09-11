import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { readSessionToken } from "@/infrastructure/http/session-cookie";

export async function GET() {
  const { APP_URL } = getEnv();
  const current = await getAuthServices().getCurrentSession(await readSessionToken(APP_URL));
  if (!current) return errorResponse(401, "unauthenticated");

  return jsonResponse({
    user: current.user,
    activeCompanyId: current.session.activeCompanyId,
    memberships: current.memberships,
  });
}
