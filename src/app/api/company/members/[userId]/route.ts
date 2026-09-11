import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const userIdSchema = z.uuid();

/**
 * Remove o membro da empresa ativa. O vínculo não é apagado — a auditoria
 * continua ligada a ele —, fica `REMOVED`: sem acesso e fora das listagens.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const prepared = await prepareWrite(request, "members.manage", { body: false });
  if (!prepared.ok) return prepared.response;

  const userId = userIdSchema.safeParse((await params).userId);
  if (!userId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().members.remove(context, userId.data, requestInfo);
  return result.ok ? noContentResponse() : memberFailureResponse(result);
}

/**
 * Membro da empresa ativa. Pessoa de outra empresa, inexistente ou id inválido
 * recebem a mesma resposta 404 (proteção contra IDOR e enumeração).
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("members.read", request);
  if (!authorization.ok) return authorization.response;

  const userId = userIdSchema.safeParse((await params).userId);
  if (!userId.success) return errorResponse(404, "not_found");

  const member = await services.company.findMember(authorization.context, userId.data);
  return member ? jsonResponse({ member }) : errorResponse(404, "not_found");
}
