/** Hash de senha lento e com salt (implementação: Argon2id). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Nunca lança por hash malformado: responde `false`. */
  verify(passwordHash: string, password: string): Promise<boolean>;
}
