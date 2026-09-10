/**
 * Porta de Object Storage PRIVADO (compatível com S3/R2).
 * Somente contrato — implementação prevista para a FASE 6.
 *
 * Regras que toda implementação deve respeitar:
 * - bucket privado, sem listagem pública;
 * - objetos isolados por tenant (`companyId` obrigatório em toda operação);
 * - chaves internas não previsíveis (nunca o nome original do arquivo);
 * - download apenas via URL assinada e temporária, emitida após autorização
 *   no backend.
 */
export interface PutObjectInput {
  readonly companyId: string;
  readonly objectKey: string;
  readonly body: Uint8Array | ReadableStream<Uint8Array>;
  readonly contentType: string;
  readonly contentLength: number;
}

export interface SignedDownloadUrlInput {
  readonly companyId: string;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
}

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<void>;
  createSignedDownloadUrl(input: SignedDownloadUrlInput): Promise<SignedUrl>;
  deleteObject(input: { readonly companyId: string; readonly objectKey: string }): Promise<void>;
}
