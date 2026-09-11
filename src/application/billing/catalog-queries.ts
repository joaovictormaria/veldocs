import type { BillingCatalogRepository } from "@/application/ports/billing-catalog";
import { quoteMonthly } from "@/domain/billing/pricing";

/**
 * Catálogo comercial com preço vigente e orçamento mensal — a base do "preço
 * em tempo real" do Builder (MASTER SPEC 2.4). A data vem sempre do servidor.
 */
export function createCatalogQueries(deps: {
  readonly repository: BillingCatalogRepository;
  readonly now: () => Date;
}) {
  return {
    listCatalog: () => deps.repository.listCatalog(deps.now()),

    async quote(selection: readonly string[]) {
      const catalog = await deps.repository.listCatalog(deps.now());
      const prices = new Map(
        catalog.flatMap((entry) =>
          entry.monthlyPriceCents === null ? [] : [[entry.key, entry.monthlyPriceCents] as const],
        ),
      );
      return quoteMonthly(selection, prices);
    },
  };
}

export type CatalogQueries = ReturnType<typeof createCatalogQueries>;
