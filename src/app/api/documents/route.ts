import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

/**
 * Documentos da empresa ativa, com busca (`q`), filtros (`categoryId`, `tag`,
 * `responsibleUserId`, `branchId`, `departmentId`), ordenação (`sort`) e
 * paginação (`page`, `pageSize`).
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const result = await services.documents.list(authorization.context, query);
  return writeResponse(result, (page) => page);
}

export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "documents.create");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documents.create(context, body, requestInfo);
  return writeResponse(result, (document) => ({ document }), 201);
}
