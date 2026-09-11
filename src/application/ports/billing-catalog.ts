/** Módulo do catálogo comercial com o preço mensal vigente. */
export interface CatalogModule {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly benefit: string;
  readonly isCore: boolean;
  readonly status: "AVAILABLE" | "COMING_SOON" | "RETIRED";
  readonly dependsOn: readonly string[];
  /** Preço mensal vigente em centavos; `null` = sem preço vigente na data. */
  readonly monthlyPriceCents: number | null;
  readonly currency: string | null;
}

/** Kit comercial com o preço mensal vigente. */
export interface CatalogKit {
  readonly key: string;
  readonly name: string;
  /** "Indicado para". */
  readonly audience: string;
  /** Módulos incluídos, na ordem do catálogo de módulos. */
  readonly modules: readonly string[];
  readonly monthlyPriceCents: number | null;
  readonly currency: string | null;
}

/** Catálogo global: descreve o produto, não uma empresa. */
export interface BillingCatalogRepository {
  /** Módulos na ordem de exibição, com o preço vigente em `at`. */
  listCatalog(at: Date): Promise<CatalogModule[]>;
  /** Kits na ordem de exibição, com o preço vigente em `at`. */
  listKits(at: Date): Promise<CatalogKit[]>;
}
