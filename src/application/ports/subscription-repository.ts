import type { SubscriptionStatus } from "@/domain/billing/subscription-status";

/** A empresa já tem assinatura: o trial só pode ser iniciado uma vez. */
export class TrialAlreadyStartedError extends Error {
  constructor() {
    super("a empresa já tem assinatura");
    this.name = "TrialAlreadyStartedError";
  }
}

export interface StoredSubscription {
  readonly status: SubscriptionStatus;
  readonly kitKey: string | null;
  readonly trialStartedAt: Date | null;
  readonly trialEndsAt: Date | null;
  readonly canceledAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly reactivatedAt: Date | null;
}

export interface NewTrial {
  readonly companyId: string;
  readonly kitKey: string | null;
  /** Módulos já resolvidos: Core + kit + extras + dependências. */
  readonly modules: readonly string[];
  readonly startedAt: Date;
  readonly endsAt: Date;
}

/** Assinatura da empresa. Toda operação é escopada pelo `companyId` recebido. */
export interface SubscriptionRepository {
  findByCompany(companyId: string): Promise<StoredSubscription | null>;
  /** Chaves dos módulos ativos da empresa, na ordem do catálogo. */
  listActiveModules(companyId: string): Promise<string[]>;
  /**
   * Cria a assinatura em trial e ativa os módulos na mesma transação.
   * @throws {TrialAlreadyStartedError} a empresa já tem assinatura.
   */
  startTrial(trial: NewTrial): Promise<{ readonly id: string }>;
}
