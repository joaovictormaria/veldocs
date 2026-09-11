import { z } from "zod";

export const EMAIL_MAX_LENGTH = 320;

/** E-mail normalizado: sem espaços nas pontas e em minúsculas (espelha o CHECK do banco). */
export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX_LENGTH, { error: "e-mail inválido" })
  .toLowerCase()
  .pipe(z.email({ error: "e-mail inválido" }));
