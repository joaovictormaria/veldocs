import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { fileFailureResponse } from "@/infrastructure/http/file-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { requestContext } from "@/infrastructure/http/request-security";
import { errorResponse } from "@/infrastructure/http/responses";

const idSchema = z.uuid();

type Params = { params: Promise<{ documentId: string; fileId: string }> };

/**
 * Download (MASTER SPEC 8): sessão → empresa → permissão → entitlement →
 * arquivo da empresa → URL assinada de poucos minutos. Responde com
 * redirecionamento para o bucket, então o arquivo nunca passa pelo servidor;
 * cada download fica na auditoria.
 */
export async function GET(request: Request, { params }: Params) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const ids = z.object({ documentId: idSchema, fileId: idSchema }).safeParse(await params);
  if (!ids.success) return errorResponse(404, "not_found");

  const result = await services.documentFiles.download(
    authorization.context,
    ids.data.documentId,
    ids.data.fileId,
    requestContext(request),
  );
  if (!result.ok) return fileFailureResponse(result);

  const response = NextResponse.redirect(result.data.url, 302);
  response.headers.set("Cache-Control", "no-store");
  // A URL assinada não deve seguir para outros sites pelo cabeçalho Referer.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
