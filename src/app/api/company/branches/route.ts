import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

/** Filiais da empresa ativa. */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("branches.read", request);
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ branches: await services.companyManagement.listBranches(authorization.context) });
}

export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "branches.manage");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.createBranch(context, body, requestInfo);
  return writeResponse(result, (branch) => ({ branch }), 201);
}
