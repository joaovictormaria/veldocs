const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

/** Centavos → "R$ 169,80". */
export function formatBRL(cents: number): string {
  return currency.format(cents / 100);
}

/** Data no fuso de Brasília → "18 de setembro de 2026". */
export function formatDate(value: string | Date): string {
  return longDate.format(new Date(value));
}

export function pluralizeDays(days: number): string {
  return days === 1 ? "1 dia restante" : `${days} dias restantes`;
}
