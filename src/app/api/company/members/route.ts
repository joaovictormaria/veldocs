import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { jsonResponse } from "@/infrastructure/http/responses";

/** Membros da empresa ativa. */
export async function GET() {
  const authorization = await authorizeRequest("members.read");
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ members: await getAuthServices().company.listMembers(authorization.context) });
}
