import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";

/** Empresa ativa da sessão. */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("company.read", request);
  if (!authorization.ok) return authorization.response;

  const company = await services.company.currentCompany(authorization.context);
  return company ? jsonResponse({ company }) : errorResponse(404, "not_found");
}
