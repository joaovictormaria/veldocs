import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeFailureResponse, writeResponse } from "@/infrastructure/http/write-route";

const documentIdSchema = z.uuid();

type Params = { params: Promise<{ documentId: string }> };

/** Documento de outra empresa, inexistente ou id inválido: sempre 404 (anti-IDOR). */
const readDocumentId = async (params: Params["params"]) => documentIdSchema.safeParse((await params).documentId);

export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const documentId = await readDocumentId(params);
  if (!documentId.success) return errorResponse(404, "not_found");

  const document = await services.documents.find(authorization.context, documentId.data);
  return document ? jsonResponse({ document }) : errorResponse(404, "not_found");
}

export async function PATCH(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "documents.update");
  if (!prepared.ok) return prepared.response;

  const documentId = await readDocumentId(params);
  if (!documentId.success) return errorResponse(404, "not_found");

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documents.update(context, documentId.data, body, requestInfo);
  return writeResponse(result, (document) => ({ document }));
}

export async function DELETE(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "documents.delete", { body: false });
  if (!prepared.ok) return prepared.response;

  const documentId = await readDocumentId(params);
  if (!documentId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documents.remove(context, documentId.data, requestInfo);
  return result.ok ? noContentResponse() : writeFailureResponse(result);
}
