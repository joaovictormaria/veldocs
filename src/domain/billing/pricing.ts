import { isModuleKey, type ModuleKey, withDependencies } from "./module-catalog";

/**
 * Orçamento mensal (MASTER SPEC 2.4, 2.5 e 2.7): o total é sempre calculado no
 * backend, a partir dos preços vigentes, e nunca confiado ao frontend.
 * Dinheiro em centavos inteiros, para não haver erro de arredondamento.
 */
export interface MonthlyQuote {
  /** Seleção resolvida: Core + módulos escolhidos + dependências, na ordem do catálogo. */
  readonly modules: readonly ModuleKey[];
  readonly totalCents: number;
  /** Módulos sem preço vigente: não entram no total como zero — ficam explícitos. */
  readonly unpriced: readonly ModuleKey[];
  /** Chaves que não existem no catálogo (não entram no total). */
  readonly unknown: readonly string[];
}

const assertCents = (cents: number, what: string) => {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`preço inválido para ${what}`);
};

const unknownKeys = (keys: readonly string[]) => [...new Set(keys.filter((key) => !isModuleKey(key)))];

/** Soma os preços de `keys`, separando os que não têm preço vigente. */
function sumPrices(keys: readonly ModuleKey[], monthlyPriceCents: ReadonlyMap<string, number>) {
  const unpriced: ModuleKey[] = [];
  let cents = 0;
  for (const key of keys) {
    const price = monthlyPriceCents.get(key);
    if (price === undefined) {
      unpriced.push(key);
      continue;
    }
    assertCents(price, `o módulo ${key}`);
    cents += price;
  }
  return { cents, unpriced };
}

export function quoteMonthly(
  selection: readonly string[],
  monthlyPriceCents: ReadonlyMap<string, number>,
): MonthlyQuote {
  const modules = withDependencies(selection);
  const { cents, unpriced } = sumPrices(modules, monthlyPriceCents);
  return { modules, totalCents: cents, unpriced, unknown: unknownKeys(selection) };
}

/** Kit com preço vigente, pronto para orçamento. */
export interface KitOffer {
  readonly key: string;
  readonly modules: readonly string[];
  readonly priceCents: number;
}

export interface KitQuote {
  readonly kitKey: string;
  /** Kit + módulos extras + dependências, na ordem do catálogo. */
  readonly modules: readonly ModuleKey[];
  readonly kitCents: number;
  /** Módulos cobrados fora do kit. */
  readonly extras: readonly ModuleKey[];
  readonly extrasCents: number;
  readonly totalCents: number;
  /** Extras sem preço vigente (não entram no total). */
  readonly unpriced: readonly ModuleKey[];
  readonly unknown: readonly string[];
}

/**
 * Kit + módulos avulsos (DEC-024): paga-se o preço do kit e, à parte, só os
 * módulos que ficaram fora dele.
 */
export function quoteKit(
  kit: KitOffer,
  extras: readonly string[],
  monthlyPriceCents: ReadonlyMap<string, number>,
): KitQuote {
  assertCents(kit.priceCents, `o kit ${kit.key}`);
  const inKit = new Set(kit.modules);
  const modules = withDependencies([...kit.modules, ...extras]);
  const charged = modules.filter((key) => !inKit.has(key));
  const { cents, unpriced } = sumPrices(charged, monthlyPriceCents);

  return {
    kitKey: kit.key,
    modules,
    kitCents: kit.priceCents,
    extras: charged,
    extrasCents: cents,
    totalCents: kit.priceCents + cents,
    unpriced,
    unknown: unknownKeys(extras),
  };
}

export interface KitSuggestion {
  readonly kitKey: string;
  /** Total da mesma seleção usando o kit (kit + o que ficar de fora). */
  readonly totalCents: number;
  readonly savingsCents: number;
}

/**
 * Sugestão do Builder (DEC-024): o kit que deixa a mesma seleção mais barata,
 * mesmo que traga módulos a mais. Só sugere com economia real, e não sugere
 * quando falta preço para comparar.
 */
export function suggestKit(
  selection: readonly string[],
  monthlyPriceCents: ReadonlyMap<string, number>,
  kits: readonly KitOffer[],
): KitSuggestion | null {
  const individual = quoteMonthly(selection, monthlyPriceCents);
  if (individual.unpriced.length > 0) return null;

  let best: KitSuggestion | null = null;
  for (const kit of kits) {
    const withKit = quoteKit(kit, individual.modules, monthlyPriceCents);
    if (withKit.unpriced.length > 0) continue;

    const savingsCents = individual.totalCents - withKit.totalCents;
    if (savingsCents > 0 && (best === null || savingsCents > best.savingsCents)) {
      best = { kitKey: kit.key, totalCents: withKit.totalCents, savingsCents };
    }
  }
  return best;
}
