import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeFailureResponse, writeResponse } from "@/infrastructure/http/write-route";

const departmentIdSchema = z.uuid();

type Params = { params: Promise<{ departmentId: string }> };

/** Setor de outra empresa, inexistente ou id inválido: sempre 404 (anti-IDOR). */
const readDepartmentId = async (params: Params["params"]) => departmentIdSchema.safeParse((await params).departmentId);

export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("departments.read", request);
  if (!authorization.ok) return authorization.response;

  const departmentId = await readDepartmentId(params);
  if (!departmentId.success) return errorResponse(404, "not_found");

  const department = await services.companyManagement.findDepartment(authorization.context, departmentId.data);
  return department ? jsonResponse({ department }) : errorResponse(404, "not_found");
}

export async function PATCH(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "departments.manage");
  if (!prepared.ok) return prepared.response;

  const departmentId = await readDepartmentId(params);
  if (!departmentId.success) return errorResponse(404, "not_found");

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.updateDepartment(
    context,
    departmentId.data,
    body,
    requestInfo,
  );
  return writeResponse(result, (department) => ({ department }));
}

export async function DELETE(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "departments.manage", { body: false });
  if (!prepared.ok) return prepared.response;

  const departmentId = await readDepartmentId(params);
  if (!departmentId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().companyManagement.deleteDepartment(context, departmentId.data, requestInfo);
  return result.ok ? noContentResponse() : writeFailureResponse(result);
}
