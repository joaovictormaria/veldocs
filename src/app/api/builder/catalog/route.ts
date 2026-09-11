import { TRIAL_DAYS } from "@/domain/billing/subscription-status";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";

/** Catálogo do Builder: módulos e kits com os preços vigentes (MASTER SPEC 2.4). */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("billing.read", request);
  if (!authorization.ok) return authorization.response;

  const [modules, kits] = await Promise.all([services.catalog.listCatalog(), services.catalog.listKits()]);
  return jsonResponse({ currency: "BRL", trialDays: TRIAL_DAYS, modules, kits });
}
