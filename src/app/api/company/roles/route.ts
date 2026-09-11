import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";

/** Perfis da empresa ativa, com permissões e quantidade de membros ativos. */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("roles.read", request);
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ roles: await services.members.listRoles(authorization.context) });
}
