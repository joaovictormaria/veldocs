import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";

const userIdSchema = z.uuid();

/**
 * Membro da empresa ativa. Pessoa de outra empresa, inexistente ou id inválido
 * recebem a mesma resposta 404 (proteção contra IDOR e enumeração).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const authorization = await authorizeRequest("members.read");
  if (!authorization.ok) return authorization.response;

  const userId = userIdSchema.safeParse((await params).userId);
  if (!userId.success) return errorResponse(404, "not_found");

  const member = await getAuthServices().company.findMember(authorization.context, userId.data);
  return member ? jsonResponse({ member }) : errorResponse(404, "not_found");
}
