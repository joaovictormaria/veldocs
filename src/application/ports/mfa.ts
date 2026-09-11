export interface TotpCredentialSummary {
  readonly confirmed: boolean;
}

export interface TotpSecretState {
  /** Segredo em base32, decifrado pela infraestrutura. */
  readonly secret: string;
  readonly confirmed: boolean;
  /** Último passo de tempo aceito (impede reuso do mesmo código). */
  readonly lastUsedStep: number | null;
}

export interface MfaRepository {
  findCredential(userId: string): Promise<TotpCredentialSummary | null>;
  findSecret(userId: string): Promise<TotpSecretState | null>;
  /** Substitui qualquer segredo ainda não confirmado. */
  startEnrollment(userId: string, secret: string): Promise<void>;
  confirmEnrollment(userId: string, at: Date, step: number): Promise<void>;
  recordUsedStep(userId: string, step: number, at: Date): Promise<void>;
  /** Descarta os códigos anteriores e grava os novos (somente hashes). */
  replaceRecoveryCodes(userId: string, codeHashes: readonly string[]): Promise<void>;
  /** Consome um código de recuperação ainda não usado; `false` se não existir. */
  consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean>;
  countUnusedRecoveryCodes(userId: string): Promise<number>;
}

export interface MfaService {
  generateSecret(): string;
  keyUri(input: { readonly secret: string; readonly accountName: string }): string;
  verifyTotp(input: {
    readonly secret: string;
    readonly code: string;
    readonly at: Date;
    readonly lastUsedStep: number | null;
  }): { readonly step: number } | null;
  generateRecoveryCodes(count: number): string[];
}
