import { type SubscriptionRepository, TrialAlreadyStartedError } from "@/application/ports/subscription-repository";
import type { PrismaClient } from "@/generated/prisma/client";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

export function createPrismaSubscriptionRepository(prisma: PrismaClient): SubscriptionRepository {
  return {
    findByCompany(companyId) {
      return prisma.subscription.findUnique({
        where: { companyId },
        select: {
          status: true,
          kitKey: true,
          trialStartedAt: true,
          trialEndsAt: true,
          canceledAt: true,
          suspendedAt: true,
          reactivatedAt: true,
        },
      });
    },

    async listActiveModules(companyId) {
      const rows = await prisma.companyModule.findMany({
        where: { companyId, status: "ACTIVE" },
        select: { module: { select: { key: true, sortOrder: true } } },
      });
      return rows
        .map((row) => row.module)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((entry) => entry.key);
    },

    /**
     * Uma transação: a assinatura em trial e os módulos ativados nascem
     * juntos. `subscriptions.company_id` é único, então uma segunda tentativa
     * — inclusive simultânea — falha no banco.
     */
    async startTrial(trial) {
      try {
        return await prisma.$transaction(async (tx) => {
          const created = await tx.subscription.create({
            data: {
              companyId: trial.companyId,
              status: "TRIALING",
              kitKey: trial.kitKey,
              trialStartedAt: trial.startedAt,
              trialEndsAt: trial.endsAt,
            },
            select: { id: true },
          });

          for (const moduleKey of trial.modules) {
            await tx.companyModule.upsert({
              where: { companyId_moduleKey: { companyId: trial.companyId, moduleKey } },
              create: { companyId: trial.companyId, moduleKey, status: "ACTIVE", activatedAt: trial.startedAt },
              // O Core já existe desde o cadastro: mantém a data de ativação original.
              update: { status: "ACTIVE", deactivatedAt: null },
            });
          }

          return created;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new TrialAlreadyStartedError();
        throw error;
      }
    },
  };
}
