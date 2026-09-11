import type { EntitlementService } from "@/application/ports/access-control";
import { isCoreModule } from "@/domain/billing/module-catalog";
import { effectiveStatus, grantsAccess } from "@/domain/billing/subscription-status";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Entitlement real (MASTER SPEC 17.2): empresa → assinatura → módulos ativos.
 *
 * Ordem das regras:
 * 1. Assinatura existente e inválida (trial vencido, atraso, cancelada ou
 *    suspensa): bloqueia TUDO, Core incluído. Os dados não são tocados
 *    (DEC-022, decisão do usuário).
 * 2. Core: liberado. Inclui a empresa SEM assinatura — ela ainda não passou
 *    pelo Builder, onde o trial começa. Bloquear esse caso trancaria toda
 *    conta recém-criada (e todas as que já existem).
 * 3. Módulo pago: exige assinatura válida e contratação ativa.
 */
export function createDatabaseEntitlementService(
  prisma: PrismaClient,
  now: () => Date = () => new Date(),
): EntitlementService {
  return {
    async checkModule(companyId, moduleKey) {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId },
        select: { status: true, trialEndsAt: true, reactivatedAt: true },
      });

      if (subscription && !grantsAccess(effectiveStatus(subscription, now()))) {
        return "subscription_inactive";
      }
      if (isCoreModule(moduleKey)) return "enabled";
      if (!subscription) return "module_not_enabled";

      const companyModule = await prisma.companyModule.findUnique({
        where: { companyId_moduleKey: { companyId, moduleKey } },
        select: { status: true },
      });
      return companyModule?.status === "ACTIVE" ? "enabled" : "module_not_enabled";
    },
  };
}
