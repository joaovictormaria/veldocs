import type { BillingCatalogRepository, CatalogKit, CatalogModule } from "@/application/ports/billing-catalog";
import { type KitOffer, quoteKit, quoteMonthly, suggestKit } from "@/domain/billing/pricing";

const pricesOf = (catalog: readonly CatalogModule[]) =>
  new Map(
    catalog.flatMap((entry) => (entry.monthlyPriceCents === null ? [] : [[entry.key, entry.monthlyPriceCents] as const])),
  );

/** Só kits com preço vigente podem ser orçados ou sugeridos. */
const offersOf = (kits: readonly CatalogKit[]): KitOffer[] =>
  kits.flatMap((kit) =>
    kit.monthlyPriceCents === null ? [] : [{ key: kit.key, modules: kit.modules, priceCents: kit.monthlyPriceCents }],
  );

/**
 * Catálogo comercial com preços vigentes, orçamento e sugestão de kit — a base
 * do "preço em tempo real" do Builder (MASTER SPEC 2.4). A data vem sempre do
 * servidor.
 */
export function createCatalogQueries(deps: {
  readonly repository: BillingCatalogRepository;
  readonly now: () => Date;
}) {
  const load = async () => {
    const at = deps.now();
    const [catalog, kits] = await Promise.all([deps.repository.listCatalog(at), deps.repository.listKits(at)]);
    return { prices: pricesOf(catalog), offers: offersOf(kits) };
  };

  return {
    listCatalog: () => deps.repository.listCatalog(deps.now()),
    listKits: () => deps.repository.listKits(deps.now()),

    /** Orçamento avulso e, se existir, o kit que deixaria a mesma seleção mais barata. */
    async quote(selection: readonly string[]) {
      const { prices, offers } = await load();
      return { ...quoteMonthly(selection, prices), suggestion: suggestKit(selection, prices, offers) };
    },

    /** Kit + módulos avulsos. `null` se o kit não existe ou não tem preço vigente. */
    async quoteKit(kitKey: string, extras: readonly string[]) {
      const { prices, offers } = await load();
      const offer = offers.find((kit) => kit.key === kitKey);
      return offer ? quoteKit(offer, extras, prices) : null;
    },
  };
}

export type CatalogQueries = ReturnType<typeof createCatalogQueries>;
