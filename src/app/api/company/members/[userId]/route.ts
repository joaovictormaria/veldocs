import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";

const userIdSchema = z.uuid();

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
