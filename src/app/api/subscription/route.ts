import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";

/**
 * Situação da assinatura da empresa ativa: estado, dias restantes do trial,
 * módulos, kit, valor após o trial e retenção. Continua respondendo com a
 * assinatura bloqueada — é o caminho para assinar ou reativar (MASTER SPEC 2.9).
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("billing.read", request);
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ subscription: await services.subscriptions.getSummary(authorization.context) });
}
