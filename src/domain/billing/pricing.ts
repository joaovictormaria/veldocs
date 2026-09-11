import { isModuleKey, type ModuleKey, withDependencies } from "./module-catalog";

/**
 * Orçamento mensal (MASTER SPEC 2.4 e 2.5): o total é sempre calculado no
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

export function quoteMonthly(
  selection: readonly string[],
  monthlyPriceCents: ReadonlyMap<string, number>,
): MonthlyQuote {
  const modules = withDependencies(selection);
  const unknown = [...new Set(selection.filter((key) => !isModuleKey(key)))];
  const unpriced: ModuleKey[] = [];
  let totalCents = 0;

  for (const key of modules) {
    const cents = monthlyPriceCents.get(key);
    if (cents === undefined) {
      unpriced.push(key);
      continue;
    }
    if (!Number.isInteger(cents) || cents < 0) throw new Error(`preço inválido para o módulo ${key}`);
    totalCents += cents;
  }

  return { modules, totalCents, unpriced, unknown };
}
