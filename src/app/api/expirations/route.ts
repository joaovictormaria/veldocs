import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { writeResponse } from "@/infrastructure/http/write-route";

/**
 * Painel de vencimentos (MASTER SPEC 10.2): contagem por situação e os
 * documentos que vencem antes. Capacidade do módulo Controle de vencimentos —
 * `expirations.read` exige o módulo contratado, conferido na autorização.
 *
 * `?days=30` muda a janela do alerta; `?limit=10`, quantos documentos voltam.
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("expirations.read", request);
  if (!authorization.ok) return authorization.response;

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const result = await services.expirations.summary(authorization.context, query);
  return writeResponse(result, (summary) => summary);
}
