import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { errorResponse } from "@/infrastructure/http/responses";
import { prepareWrite, writeResponse } from "@/infrastructure/http/write-route";

const documentIdSchema = z.uuid();

type Params = { params: Promise<{ documentId: string }> };

/**
 * Renovação do documento (MASTER SPEC 10.2): novas datas, mesmo documento.
 * Capacidade do módulo Controle de vencimentos (`expirations.manage`).
 * Corpo: `{ "issueDate": "2027-01-10", "expirationDate": "2028-01-09" }`.
 */
export async function POST(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "expirations.manage");
  if (!prepared.ok) return prepared.response;

  const documentId = documentIdSchema.safeParse((await params).documentId);
  if (!documentId.success) return errorResponse(404, "not_found");

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().expirations.renew(context, documentId.data, body, requestInfo);
  return writeResponse(result, (document) => ({ document }));
}
