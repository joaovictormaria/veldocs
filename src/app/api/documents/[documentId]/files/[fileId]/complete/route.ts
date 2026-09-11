import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { fileResponse } from "@/infrastructure/http/file-responses";
import { errorResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const idSchema = z.uuid();

type Params = { params: Promise<{ documentId: string; fileId: string }> };

/**
 * Conclui o envio: o servidor confere no bucket o tamanho e a assinatura do
 * conteúdo. O que confere fica disponível; o que não confere é apagado.
 */
export async function POST(request: Request, { params }: Params) {
  const prepared = await prepareWrite(request, "documents.update", { body: false });
  if (!prepared.ok) return prepared.response;

  const { documentId, fileId } = await params;
  const ids = z.object({ documentId: idSchema, fileId: idSchema }).safeParse({ documentId, fileId });
  if (!ids.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().documentFiles.completeUpload(
    context,
    ids.data.documentId,
    ids.data.fileId,
    requestInfo,
  );
  return fileResponse(result, (file) => ({ file }));
}
