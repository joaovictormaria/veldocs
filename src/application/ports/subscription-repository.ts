import type { SubscriptionStatus } from "@/domain/billing/subscription-status";

/** A empresa já tem assinatura: o trial só pode ser iniciado uma vez. */
export class TrialAlreadyStartedError extends Error {
  constructor() {
    super("a empresa já tem assinatura");
    this.name = "TrialAlreadyStartedError";
  }
}

/** A assinatura não está (mais) em teste grátis vigente: a troca de módulos não vale. */
export class SubscriptionNotInTrialError extends Error {
  constructor() {
    super("a assinatura não está em teste grátis vigente");
    this.name = "SubscriptionNotInTrialError";
  }
}

export interface StoredSubscription {
  readonly id: string;
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

export interface ModuleChange {
  readonly companyId: string;
  readonly kitKey: string | null;
  /** Nova seleção já resolvida: Core + kit + extras + dependências. */
  readonly modules: readonly string[];
  readonly at: Date;
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
  /**
   * Troca kit e módulos de uma assinatura em trial vigente, na mesma transação:
   * ativa os novos e desativa os que saíram, sem apagar nada.
   * @throws {SubscriptionNotInTrialError} o trial não está vigente no momento da gravação.
   */
  changeModules(change: ModuleChange): Promise<{ readonly activated: string[]; readonly deactivated: string[] }>;
}
