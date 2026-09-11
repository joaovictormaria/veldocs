/**
 * Estados da assinatura (MASTER SPEC 2.8 e 2.9).
 *
 * O banco guarda o estado CANÔNICO — aquele que só muda por uma ação
 * (contratar, cancelar, suspender, pagamento pendente). Os estados do trial
 * que dependem apenas da passagem do tempo (`TRIAL_EXPIRING` e
 * `TRIAL_EXPIRED`) são DERIVADOS da data de término a cada leitura, e não
 * gravados: assim não é preciso um processo agendado virando linhas de hora
 * em hora, e não existe a janela em que o banco diz "em trial" enquanto o
 * prazo já venceu.
 */

/** Estado gravado no banco. */
export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAYMENT_PENDING",
  "PAST_DUE",
  "CANCELED",
  "SUSPENDED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Estado apresentado ao cliente, já considerando o tempo decorrido. */
export const EFFECTIVE_STATUSES = [
  "TRIAL_ACTIVE",
  "TRIAL_EXPIRING",
  "TRIAL_EXPIRED",
  "ACTIVE",
  "REACTIVATED",
  "PAYMENT_PENDING",
  "PAST_DUE",
  "CANCELED",
  "SUSPENDED",
] as const;
export type EffectiveStatus = (typeof EFFECTIVE_STATUSES)[number];

export const TRIAL_DAYS = 14;
/** A partir daqui o trial é apresentado como "terminando" (MASTER SPEC 2.8). */
export const TRIAL_EXPIRING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SubscriptionState {
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  /** Preenchido quando uma assinatura cancelada/suspensa volta a valer. */
  readonly reactivatedAt: Date | null;
}

export function trialEndFrom(startedAt: Date, days = TRIAL_DAYS): Date {
  return new Date(startedAt.getTime() + days * DAY_MS);
}

/** Dias inteiros restantes (0 quando já terminou). Só faz sentido em trial. */
export function trialDaysRemaining(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

export function effectiveStatus(state: SubscriptionState, now: Date): EffectiveStatus {
  if (state.status !== "TRIALING") {
    return state.status === "ACTIVE" && state.reactivatedAt ? "REACTIVATED" : state.status;
  }

  // Trial sem data de término não expira sozinho; trata-se como ativo.
  if (!state.trialEndsAt) return "TRIAL_ACTIVE";

  const remainingMs = state.trialEndsAt.getTime() - now.getTime();
  if (remainingMs <= 0) return "TRIAL_EXPIRED";
  return remainingMs <= TRIAL_EXPIRING_DAYS * DAY_MS ? "TRIAL_EXPIRING" : "TRIAL_ACTIVE";
}

/**
 * Estados em que a empresa pode usar o sistema.
 *
 * Decisão do usuário (2026-09-11, DEC-022): sem assinatura válida o bloqueio
 * é TOTAL — Core incluído — e não há carência na inadimplência. Nada é
 * apagado: os dados ficam guardados e voltam a ficar acessíveis quando a
 * empresa assinar.
 *
 * `PAYMENT_PENDING` libera porque o pagamento está em processamento, e não em
 * atraso; `PAST_DUE` (atraso reconhecido) bloqueia na hora.
 */
const GRANTS_ACCESS: ReadonlySet<EffectiveStatus> = new Set<EffectiveStatus>([
  "TRIAL_ACTIVE",
  "TRIAL_EXPIRING",
  "ACTIVE",
  "REACTIVATED",
  "PAYMENT_PENDING",
]);

export function grantsAccess(status: EffectiveStatus): boolean {
  return GRANTS_ACCESS.has(status);
}

/** Transições permitidas do estado canônico. */
const ALLOWED_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  TRIALING: ["ACTIVE", "PAYMENT_PENDING", "CANCELED", "SUSPENDED"],
  PAYMENT_PENDING: ["ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"],
  ACTIVE: ["PAYMENT_PENDING", "PAST_DUE", "CANCELED", "SUSPENDED"],
  PAST_DUE: ["ACTIVE", "PAYMENT_PENDING", "CANCELED", "SUSPENDED"],
  CANCELED: ["ACTIVE", "PAYMENT_PENDING"],
  SUSPENDED: ["ACTIVE", "PAYMENT_PENDING", "CANCELED"],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Voltar de CANCELED/SUSPENDED para ACTIVE conta como reativação (2.9). */
export function isReactivation(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return to === "ACTIVE" && (from === "CANCELED" || from === "SUSPENDED");
}

/**
 * Retenção de dados depois do fim da assinatura (decisão do usuário,
 * 2026-09-11, DEC-025):
 * - CANCELED: dados e login guardados por 1 ano (obrigação legal; prazo a
 *   confirmar com o jurídico);
 * - SUSPENDED: dados guardados por 2 meses; depois a conta pode ser apagada.
 *
 * Nos dois casos o acesso segue bloqueado (`grantsAccess`). Estas funções só
 * informam o prazo: nada é apagado automaticamente.
 */
export const DATA_RETENTION_DAYS = { CANCELED: 365, SUSPENDED: 60 } as const;

export interface RetentionState {
  readonly status: SubscriptionStatus;
  readonly canceledAt: Date | null;
  readonly suspendedAt: Date | null;
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

export function dataRetentionUntil(state: RetentionState): Date | null {
  if (state.status === "CANCELED" && state.canceledAt) {
    return addDays(state.canceledAt, DATA_RETENTION_DAYS.CANCELED);
  }
  if (state.status === "SUSPENDED" && state.suspendedAt) {
    return addDays(state.suspendedAt, DATA_RETENTION_DAYS.SUSPENDED);
  }
  return null;
}

/** Prazo de retenção vencido: a conta PODE ser apagada (a exclusão em si não existe ainda). */
export function isRetentionExpired(state: RetentionState, now: Date): boolean {
  const until = dataRetentionUntil(state);
  return until !== null && now.getTime() >= until.getTime();
}
