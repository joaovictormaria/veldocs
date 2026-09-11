import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeFailureResponse, writeResponse } from "@/infrastructure/http/write-route";

const categoryIdSchema = z.uuid();

type Params = { params: Promise<{ categoryId: string }> };

/** Categoria de outra empresa, inexistente ou id inválido: sempre 404 (anti-IDOR). */
const readCategoryId = async (params: Params["params"]) => categoryIdSchema.safeParse((await params).categoryId);

export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("categories.read", request);
  if (!authorization.ok) return authorization.response;

  const categoryId = await readCategoryId(params);
  if (!categoryId.success) return errorResponse(404, "not_found");

  const category = await services.categories.find(authorization.context, categoryId.data);
  return category ? jsonResponse({ category }) : errorResponse(404, "not_found");
}

export async function PATCH(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "categories.manage");
  if (!prepared.ok) return prepared.response;

  const categoryId = await readCategoryId(params);
  if (!categoryId.success) return errorResponse(404, "not_found");

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().categories.update(context, categoryId.data, body, requestInfo);
  return writeResponse(result, (category) => ({ category }));
}

export async function DELETE(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "categories.manage", { body: false });
  if (!prepared.ok) return prepared.response;

  const categoryId = await readCategoryId(params);
  if (!categoryId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().categories.remove(context, categoryId.data, requestInfo);
  return result.ok ? noContentResponse() : writeFailureResponse(result);
}
