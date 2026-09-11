import type { EntitlementService } from "@/application/ports/access-control";
import { isCoreModule } from "@/domain/billing/module-catalog";
import { effectiveStatus, grantsPaidModules } from "@/domain/billing/subscription-status";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Entitlement real (MASTER SPEC 17.2): empresa → assinatura → módulos ativos.
 *
 * O Core nunca depende da assinatura. Ele é obrigatório (2.2) e a spec (2.9)
 * exige que, com o trial vencido, a empresa continue vendo seus dados e tenha
 * caminho para reativar — o bloqueio atinge só os módulos pagos.
 */
export function createDatabaseEntitlementService(
  prisma: PrismaClient,
  now: () => Date = () => new Date(),
): EntitlementService {
  return {
    async isModuleEnabled(companyId, moduleKey) {
      if (isCoreModule(moduleKey)) return true;

      const [companyModule, subscription] = await Promise.all([
        prisma.companyModule.findUnique({
          where: { companyId_moduleKey: { companyId, moduleKey } },
          select: { status: true },
        }),
        prisma.subscription.findUnique({
          where: { companyId },
          select: { status: true, trialEndsAt: true, reactivatedAt: true },
        }),
      ]);

      if (companyModule?.status !== "ACTIVE") return false;
      // Módulo contratado sem assinatura não é utilizável: o trial começa no
      // Builder e é ele que cria a assinatura.
      if (!subscription) return false;

      return grantsPaidModules(effectiveStatus(subscription, now()));
    },
  };
}
