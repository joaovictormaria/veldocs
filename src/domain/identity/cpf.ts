import { z } from "zod";

/**
 * CPF: 11 dígitos com dígitos verificadores válidos.
 * Aceita entrada com ou sem máscara (529.982.247-25 ou 52998224725) e
 * sempre devolve somente os dígitos.
 */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = [...cpf].map(Number);
  const checkDigit = (length: number): number => {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export const cpfSchema = z
  .string()
  .trim()
  .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { error: "CPF inválido" })
  .transform(normalizeCpf)
  .refine(isValidCpf, { error: "CPF inválido" });
