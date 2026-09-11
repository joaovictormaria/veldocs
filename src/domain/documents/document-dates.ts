import { z } from "zod";

/**
 * Emissão e validade são datas de calendário, não instantes: valem o dia
 * inteiro em qualquer fuso. Entram e saem como `AAAA-MM-DD` e ficam em colunas
 * `date`, para "vence em 30/09" não virar 29 ou 1º conforme o fuso de quem lê.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  // Rejeita 31/02 e afins: o round-trip só bate em data que existe.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const calendarDateSchema = z
  .string()
  .trim()
  .refine(isCalendarDate, { error: "use uma data no formato AAAA-MM-DD" });

/** Meia-noite UTC: é assim que o PostgreSQL devolve uma coluna `date`. */
export function toCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
