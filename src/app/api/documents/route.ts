import { EXPIRATIONS_MODULE_KEY } from "@/domain/documents/expiration";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

/**
 * Documentos da empresa ativa, com busca (`q`), filtros (`categoryId`, `tag`,
 * `responsibleUserId`, `branchId`, `departmentId`), ordenação (`sort`) e
 * paginação (`page`, `pageSize`).
 *
 * `status` e `sort=expiration` são do módulo Controle de vencimentos: sem ele,
 * a resposta é `403 module_not_enabled` e a situação não vem nos documentos.
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const entitlement = await services.entitlements.checkModule(authorization.context.companyId, EXPIRATIONS_MODULE_KEY);
  const expirations = entitlement === "enabled";

  if (!expirations && (query.status || query.sort === "expiration")) {
    return errorResponse(403, "module_not_enabled", {
      message: "Contrate o módulo Controle de vencimentos para filtrar por situação de vencimento.",
    });
  }

  const result = await services.documents.list(authorization.context, query, { expirations });
  return writeResponse(result, (page) => page);
}

export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "documents.create");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documents.create(context, body, requestInfo);
  return writeResponse(result, (document) => ({ document }), 201);
}
