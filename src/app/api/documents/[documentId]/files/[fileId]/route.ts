import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { fileFailureResponse } from "@/infrastructure/http/file-responses";
import { errorResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const idSchema = z.uuid();

type Params = { params: Promise<{ documentId: string; fileId: string }> };

/** Tira o arquivo do documento (exclusão lógica; o objeto continua guardado). */
export async function DELETE(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "documents.update", { body: false });
  if (!prepared.ok) return prepared.response;

  const ids = z.object({ documentId: idSchema, fileId: idSchema }).safeParse(await params);
  if (!ids.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documentFiles.remove(context, ids.data.documentId, ids.data.fileId, requestInfo);
  return result.ok ? noContentResponse() : fileFailureResponse(result);
}
