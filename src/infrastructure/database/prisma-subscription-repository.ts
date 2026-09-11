import {
  SubscriptionNotInTrialError,
  type SubscriptionRepository,
  TrialAlreadyStartedError,
} from "@/application/ports/subscription-repository";
import type { PrismaClient } from "@/generated/prisma/client";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

export function createPrismaSubscriptionRepository(prisma: PrismaClient): SubscriptionRepository {
  return {
    findByCompany(companyId) {
      return prisma.subscription.findUnique({
        where: { companyId },
        select: {
          id: true,
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

    /**
     * Uma transação que confere de novo, no momento da gravação, se o trial
     * ainda vale. Módulo que sai vira INACTIVE com a data; nada é apagado, e
     * voltar a escolhê-lo reativa a mesma linha.
     */
    changeModules(change) {
      return prisma.$transaction(async (tx) => {
        const current = await tx.subscription.findUnique({
          where: { companyId: change.companyId },
          select: { status: true, trialEndsAt: true },
        });
        if (
          current?.status !== "TRIALING" ||
          !current.trialEndsAt ||
          current.trialEndsAt.getTime() <= change.at.getTime()
        ) {
          throw new SubscriptionNotInTrialError();
        }

        await tx.subscription.update({ where: { companyId: change.companyId }, data: { kitKey: change.kitKey } });

        const activeRows = await tx.companyModule.findMany({
          where: { companyId: change.companyId, status: "ACTIVE" },
          select: { moduleKey: true },
        });
        const activeBefore = new Set(activeRows.map((row) => row.moduleKey));
        const wanted = new Set(change.modules);

        const deactivated = [...activeBefore].filter((key) => !wanted.has(key)).sort();
        const activated = [...wanted].filter((key) => !activeBefore.has(key)).sort();

        if (deactivated.length > 0) {
          await tx.companyModule.updateMany({
            where: { companyId: change.companyId, moduleKey: { in: deactivated } },
            data: { status: "INACTIVE", deactivatedAt: change.at },
          });
        }
        for (const moduleKey of activated) {
          await tx.companyModule.upsert({
            where: { companyId_moduleKey: { companyId: change.companyId, moduleKey } },
            create: { companyId: change.companyId, moduleKey, status: "ACTIVE", activatedAt: change.at },
            update: { status: "ACTIVE", activatedAt: change.at, deactivatedAt: null },
          });
        }

        return { activated, deactivated };
      });
    },
  };
}
