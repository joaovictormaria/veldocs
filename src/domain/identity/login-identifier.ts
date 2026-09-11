import { cpfSchema } from "./cpf";
import { emailSchema } from "./email";

export type LoginIdentifier =
  | { readonly kind: "email"; readonly email: string }
  | { readonly kind: "cpf"; readonly cpf: string };

/** Interpreta o campo único de login: e-mail (contém "@") ou CPF. */
export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const value = input.trim();

  if (value.includes("@")) {
    const email = emailSchema.safeParse(value);
    return email.success ? { kind: "email", email: email.data } : null;
  }

  const cpf = cpfSchema.safeParse(value);
  return cpf.success ? { kind: "cpf", cpf: cpf.data } : null;
}
