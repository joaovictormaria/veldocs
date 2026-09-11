const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
/** Datas de calendário são lidas em UTC: 2026-09-11 é dia 11 em qualquer fuso. */
const calendarDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/** Centavos → "R$ 169,80". */
export function formatBRL(cents: number): string {
  return currency.format(cents / 100);
}

/** Data no fuso de Brasília → "18 de setembro de 2026". */
export function formatDate(value: string | Date): string {
  return longDate.format(new Date(value));
}

/**
 * Emissão e validade (`AAAA-MM-DD`) → "11/09/2026". Formatar no fuso local
 * mudaria o dia: 2026-09-11 vira 10/09 em Brasília.
 */
export function formatCalendarDate(value: string): string {
  return calendarDate.format(new Date(`${value}T00:00:00.000Z`));
}

export function pluralizeDays(days: number): string {
  return days === 1 ? "1 dia restante" : `${days} dias restantes`;
}
