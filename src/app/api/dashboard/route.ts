import { EXPIRATIONS_MODULE_KEY } from "@/domain/documents/expiration";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";

/**
 * Painel da empresa (MASTER SPEC 11.1). `expirations` vem só com o módulo
 * Controle de vencimentos; `activity`, só para quem tem `audit.read`.
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("documents.read", request);
  if (!authorization.ok) return authorization.response;

  const { context } = authorization;
  const expirations = (await services.entitlements.checkModule(context.companyId, EXPIRATIONS_MODULE_KEY)) === "enabled";

  return jsonResponse(await services.dashboard.summary(context, { expirations }));
}
