import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

/** Categorias de documentos da empresa ativa, com o caminho completo de cada uma. */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("categories.read", request);
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ categories: await services.categories.list(authorization.context) });
}

export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "categories.manage");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().categories.create(context, body, requestInfo);
  return writeResponse(result, (category) => ({ category }), 201);
}
