export type DocumentFileStatus = "PENDING" | "AVAILABLE" | "REJECTED";

export interface DocumentFileRecord {
  readonly id: string;
  readonly documentId: string;
  /** Interno: nunca sai na API. */
  readonly objectKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly status: DocumentFileStatus;
  readonly uploadedBy: { readonly userId: string; readonly name: string };
  readonly uploadExpiresAt: Date;
  readonly availableAt: Date | null;
  readonly createdAt: Date;
}

export interface NewDocumentFile {
  readonly id: string;
  readonly companyId: string;
  readonly documentId: string;
  readonly objectKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedById: string;
  readonly uploadExpiresAt: Date;
}

/**
 * Metadados dos arquivos dos documentos. Toda operação é escopada pela empresa
 * do contexto autorizado; arquivo excluído (lógico) não é encontrado.
 */
export interface DocumentFileRepository {
  /** Documento vivo da empresa. */
  documentExists(companyId: string, documentId: string): Promise<boolean>;
  createPending(file: NewDocumentFile): Promise<DocumentFileRecord>;
  findFile(companyId: string, documentId: string, fileId: string): Promise<DocumentFileRecord | null>;
  /** Só muda de PENDING para AVAILABLE; devolve `null` se já não estava pendente. */
  markAvailable(companyId: string, fileId: string, at: Date): Promise<DocumentFileRecord | null>;
  markRejected(companyId: string, fileId: string, reason: string): Promise<void>;
  /** Arquivos disponíveis do documento, do mais recente para o mais antigo. */
  listAvailable(companyId: string, documentId: string): Promise<DocumentFileRecord[]>;
  softDelete(companyId: string, documentId: string, fileId: string, at: Date): Promise<boolean>;
}
