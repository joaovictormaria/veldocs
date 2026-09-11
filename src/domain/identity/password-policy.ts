import { z } from "zod";

/**
 * Política de senha alinhada ao OWASP ASVS 5.0: comprimento mínimo, limite
 * máximo generoso e nenhuma regra de composição (maiúscula, símbolo etc.).
 * O comprimento conta caracteres Unicode, e a senha nunca é aparada.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const length = (value: string) => [...value].length;

export const passwordSchema = z
  .string()
  .refine((value) => length(value) >= PASSWORD_MIN_LENGTH, {
    error: `a senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  .refine((value) => length(value) <= PASSWORD_MAX_LENGTH, {
    error: `a senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`,
  });
