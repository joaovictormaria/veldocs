export interface TokenService {
  /** Token aleatório de alta entropia entregue ao cliente. */
  generate(): string;
  /** Hash do token para armazenamento. */
  hash(token: string): string;
  /** Descarta entradas malformadas antes de consultar o banco. */
  isWellFormed(token: string): boolean;
}

export interface SensitiveDataProtector {
  /** HMAC com chave do servidor, separado por finalidade (ex.: "cpf", "rate-limit"). */
  lookupHash(purpose: string, value: string): string;
  /** Cifra o CPF normalizado para armazenamento. */
  encryptCpf(cpf: string): string;
}
