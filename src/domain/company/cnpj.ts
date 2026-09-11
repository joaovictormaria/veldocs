import { z } from "zod";

/**
 * CNPJ: 14 dígitos com dígitos verificadores válidos.
 * Aceita com ou sem máscara (12.345.678/0001-95 ou 12345678000195) e
 * devolve somente os dígitos.
 */
export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, ...FIRST_WEIGHTS];

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = [...cnpj].map(Number);
  const checkDigit = (weights: readonly number[]): number => {
    const sum = weights.reduce((total, weight, index) => total + (digits[index] as number) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return checkDigit(FIRST_WEIGHTS) === digits[12] && checkDigit(SECOND_WEIGHTS) === digits[13];
}

export const cnpjSchema = z
  .string()
  .trim()
  .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, { error: "CNPJ inválido" })
  .transform(normalizeCnpj)
  .refine(isValidCnpj, { error: "CNPJ inválido" });

export function formatCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
