import { MODULE_KEYS } from "@/domain/billing/module-catalog";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";

const MAX_KEY_LENGTH = 60;

/**
 * Preço em tempo real do Builder (MASTER SPEC 2.4), sempre calculado no
 * servidor:
 * - `?modules=a,b` → seleção avulsa, com o kit que a deixaria mais barata;
 * - `?kit=k&modules=a,b` → kit + módulos fora dele.
 */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("billing.read", request);
  if (!authorization.ok) return authorization.response;

  const params = new URL(request.url).searchParams;
  const modules = (params.get("modules") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const kit = params.get("kit")?.trim() || null;

  if (modules.length > MODULE_KEYS.length || modules.some((key) => key.length > MAX_KEY_LENGTH)) {
    return errorResponse(400, "invalid_input", { issues: [{ field: "modules", message: "seleção inválida" }] });
  }

  if (kit) {
    const quote = kit.length <= MAX_KEY_LENGTH ? await services.catalog.quoteKit(kit, modules) : null;
    return quote
      ? jsonResponse({ kind: "kit", currency: "BRL", quote })
      : errorResponse(400, "invalid_input", { issues: [{ field: "kit", message: "kit inexistente ou sem preço vigente" }] });
  }

  return jsonResponse({ kind: "modules", currency: "BRL", quote: await services.catalog.quote(modules) });
}
