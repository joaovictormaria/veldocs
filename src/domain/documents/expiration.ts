/**
 * Situação de vencimento (MASTER SPEC 10.2). É **derivada** da data de validade
 * e do dia de hoje, nunca gravada: guardar "vencido" exigiria um processo
 * agendado virando linhas, e entre duas execuções o banco mentiria — a mesma
 * razão dos estados do trial (DEC-022).
 */
import type { ModuleKey } from "@/domain/billing/module-catalog";

/** Módulo pago que libera situação, alertas e renovação (catálogo comercial). */
export const EXPIRATIONS_MODULE_KEY: ModuleKey = "vencimentos";

export const EXPIRING_WINDOW_DAYS = 30;

export const EXPIRATION_STATUSES = ["VALID", "EXPIRING", "EXPIRED", "NO_EXPIRATION"] as const;
export type ExpirationStatus = (typeof EXPIRATION_STATUSES)[number];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Datas de calendário são comparadas em UTC, sem parte de hora. */
const toUtc = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

/**
 * O "hoje" do cliente é o de Brasília, não o do servidor: um documento que
 * vence dia 11 não pode aparecer como vencido às 22h do dia 10 em São Paulo,
 * quando em UTC já é dia 11.
 */
export function todayInBrazil(now: Date): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = toUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Negativo quando a data já passou; 0 no próprio dia do vencimento. */
export function daysUntil(expirationDate: string, today: string): number {
  return Math.round((toUtc(expirationDate).getTime() - toUtc(today).getTime()) / DAY_IN_MS);
}

/**
 * `EXPIRING` cobre o dia do vencimento e os `windowDays` anteriores — é a
 * janela do alerta. Documento sem validade não vence: fica de fora das contas.
 */
export function expirationStatus(
  expirationDate: string | null,
  today: string,
  windowDays: number = EXPIRING_WINDOW_DAYS,
): ExpirationStatus {
  if (expirationDate === null) return "NO_EXPIRATION";

  const days = daysUntil(expirationDate, today);
  if (days < 0) return "EXPIRED";
  return days <= windowDays ? "EXPIRING" : "VALID";
}

/** Último dia que ainda entra na janela de alerta. */
export function expiringWindowEnd(today: string, windowDays: number = EXPIRING_WINDOW_DAYS): string {
  return addDays(today, windowDays);
}
