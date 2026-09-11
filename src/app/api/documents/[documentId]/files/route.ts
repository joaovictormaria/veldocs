import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { fileResponse } from "@/infrastructure/http/file-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const idSchema = z.uuid();

type Params = { params: Promise<{ documentId: string }> };

/** Arquivos disponíveis do documento. */
export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const documentId = idSchema.safeParse((await params).documentId);
  if (!documentId.success) return errorResponse(404, "not_found");

  const files = await services.documentFiles.list(authorization.context, documentId.data);
  return files ? jsonResponse({ files }) : errorResponse(404, "not_found");
}

/**
 * Pede o envio de um arquivo: `{ "fileName": "alvara.pdf", "contentType":
 * "application/pdf", "sizeBytes": 123456 }`. Responde com o formulário
 * assinado para o navegador enviar direto ao bucket; depois, o navegador chama
 * `POST …/files/[fileId]/complete`.
 */
export async function POST(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "documents.update");
  if (!prepared.ok) return prepared.response;

  const documentId = idSchema.safeParse((await params).documentId);
  if (!documentId.success) return errorResponse(404, "not_found");

  const { context, body } = prepared.prepared;
  const result = await getAuthServices().documentFiles.requestUpload(context, documentId.data, body);
  return fileResponse(result, (data) => data, 201);
}
