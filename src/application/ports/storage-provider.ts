/**
 * Porta de Object Storage PRIVADO compatível com S3 (FASE 5): Railway Storage
 * Buckets em produção, MinIO no desenvolvimento e nos testes.
 *
 * Regras que toda implementação deve respeitar:
 * - bucket privado, sem listagem pública;
 * - objetos isolados por tenant: `companyId` obrigatório em toda operação, e a
 *   chave precisa começar pelo prefixo da empresa;
 * - chaves internas não previsíveis (nunca o nome original do arquivo);
 * - envio e download apenas por URL assinada e temporária, emitida depois da
 *   autorização no backend.
 */

export interface ObjectLocation {
  readonly companyId: string;
  readonly objectKey: string;
}

export interface UploadFormInput extends ObjectLocation {
  readonly contentType: string;
  readonly maxSizeBytes: number;
  readonly expiresInSeconds: number;
}

/**
 * Formulário assinado (POST do S3): o navegador envia `fields` e o arquivo
 * direto ao bucket. A política assinada fixa chave, tipo e tamanho máximo.
 */
export interface UploadForm {
  readonly url: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface StoredObjectInfo {
  readonly sizeBytes: number;
  readonly contentType: string | null;
}

export interface SignedDownloadUrlInput extends ObjectLocation {
  readonly expiresInSeconds: number;
  /** Nome sugerido ao navegador (já higienizado). */
  readonly fileName: string;
  readonly contentType: string;
}

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StorageProvider {
  createUploadForm(input: UploadFormInput): Promise<UploadForm>;
  /** `null` quando o objeto não existe (ainda não foi enviado). */
  headObject(input: ObjectLocation): Promise<StoredObjectInfo | null>;
  /** Primeiros bytes do objeto, para conferir a assinatura do conteúdo. */
  readObjectStart(input: ObjectLocation & { readonly bytes: number }): Promise<Uint8Array>;
  createSignedDownloadUrl(input: SignedDownloadUrlInput): Promise<SignedUrl>;
  deleteObject(input: ObjectLocation): Promise<void>;
}

/** Chave fora do prefixo da empresa: bug ou tentativa de acesso cruzado. */
export class ObjectKeyOutsideTenantError extends Error {
  constructor() {
    super("chave de objeto fora do prefixo da empresa");
    this.name = "ObjectKeyOutsideTenantError";
  }
}

export function assertObjectInTenant({ companyId, objectKey }: ObjectLocation): void {
  if (!objectKey.startsWith(`companies/${companyId}/`)) throw new ObjectKeyOutsideTenantError();
}
