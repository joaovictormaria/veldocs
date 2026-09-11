import type { BillingCatalogRepository } from "@/application/ports/billing-catalog";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Preço vigente em `at`: mensal, já iniciado e ainda não encerrado. Havendo
 * mais de um (preço novo agendado sem fechar o anterior), vale o de início
 * mais recente. Mesma regra para módulos e kits.
 */
const currentMonthlyPrice = (at: Date) => ({
  where: {
    billingPeriod: "MONTHLY" as const,
    validFrom: { lte: at },
    OR: [{ validUntil: null }, { validUntil: { gt: at } }],
  },
  orderBy: { validFrom: "desc" as const },
  take: 1,
  select: { amountCents: true, currency: true },
});

export function createPrismaBillingCatalogRepository(prisma: PrismaClient): BillingCatalogRepository {
  return {
    async listCatalog(at) {
      const rows = await prisma.module.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          key: true,
          name: true,
          description: true,
          benefit: true,
          isCore: true,
          status: true,
          dependencies: { select: { dependsOnKey: true }, orderBy: { dependsOnKey: "asc" } },
          prices: currentMonthlyPrice(at),
        },
      });

      return rows.map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description,
        benefit: row.benefit,
        isCore: row.isCore,
        status: row.status,
        dependsOn: row.dependencies.map((dependency) => dependency.dependsOnKey),
        monthlyPriceCents: row.prices[0]?.amountCents ?? null,
        currency: row.prices[0]?.currency ?? null,
      }));
    },

    async listKits(at) {
      const rows = await prisma.kit.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          key: true,
          name: true,
          audience: true,
          modules: { select: { module: { select: { key: true, sortOrder: true } } } },
          prices: currentMonthlyPrice(at),
        },
      });

      return rows.map((row) => ({
        key: row.key,
        name: row.name,
        audience: row.audience,
        modules: row.modules
          .map((included) => included.module)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((module) => module.key),
        monthlyPriceCents: row.prices[0]?.amountCents ?? null,
        currency: row.prices[0]?.currency ?? null,
      }));
    },
  };
}
