import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeFailureResponse, writeResponse } from "@/infrastructure/http/write-route";

const branchIdSchema = z.uuid();

type Params = { params: Promise<{ branchId: string }> };

/** Filial de outra empresa, inexistente ou id inválido: sempre 404 (anti-IDOR). */
const readBranchId = async (params: Params["params"]) => branchIdSchema.safeParse((await params).branchId);

export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("branches.read", request);
  if (!authorization.ok) return authorization.response;

  const branchId = await readBranchId(params);
  if (!branchId.success) return errorResponse(404, "not_found");

  const branch = await services.companyManagement.findBranch(authorization.context, branchId.data);
  return branch ? jsonResponse({ branch }) : errorResponse(404, "not_found");
}

export async function PATCH(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "branches.manage");
  if (!prepared.ok) return prepared.response;

  const branchId = await readBranchId(params);
  if (!branchId.success) return errorResponse(404, "not_found");

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.updateBranch(context, branchId.data, body, requestInfo);
  return writeResponse(result, (branch) => ({ branch }));
}

export async function DELETE(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "branches.manage", { body: false });
  if (!prepared.ok) return prepared.response;

  const branchId = await readBranchId(params);
  if (!branchId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.deleteBranch(context, branchId.data, requestInfo);
  return result.ok ? noContentResponse() : writeFailureResponse(result);
}
