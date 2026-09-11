import type { EntitlementService } from "@/application/ports/access-control";
import { CORE_MODULE_KEY } from "@/domain/access-control/permission-modules";

/**
 * Implementação provisória até a FASE 3 (catálogo de módulos e entitlements
 * por empresa): o Core é obrigatório e está sempre ativo; qualquer outro
 * módulo é negado. Substituir por uma implementação baseada em CompanyModule.
 */
export function createCoreOnlyEntitlementService(): EntitlementService {
  return {
    isModuleEnabled: async (_companyId, moduleKey) => moduleKey === CORE_MODULE_KEY,
  };
}
