import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

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

/** Edita os dados cadastrais da empresa ativa. */
export async function PATCH(request: Request) {
  const prepared = await prepareWrite(request, "company.update");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.updateCompany(context, body, requestInfo);
  return writeResponse(result, (company) => ({ company }));
}
