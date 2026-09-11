import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";

/** Empresa ativa da sessão. */
export async function GET() {
  const authorization = await authorizeRequest("company.read");
  if (!authorization.ok) return authorization.response;

  const company = await getAuthServices().company.currentCompany(authorization.context);
  return company ? jsonResponse({ company }) : errorResponse(404, "not_found");
}
