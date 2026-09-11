import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";

/**
 * Prévia pública do convite para a tela do link: empresa, perfil, validade e o
 * e-mail mascarado. Expirado, revogado, usado ou inexistente: a mesma resposta 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter, { scope: "api:invitation" });
  if (limited) return limited;

  const { token } = await params;
  const invitation = token.length <= 100 ? await services.members.previewInvitation(token) : null;
  return invitation
    ? jsonResponse({ invitation })
    : memberFailureResponse({ reason: "invitation_not_available" });
}
