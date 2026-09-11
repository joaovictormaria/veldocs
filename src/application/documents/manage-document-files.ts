import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { DocumentFileRecord, DocumentFileRepository } from "@/application/ports/document-file-repository";
import type { SignedUrl, StorageProvider, UploadForm } from "@/application/ports/storage-provider";
import {
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
  buildObjectKey,
  contentMatchesType,
  extensionMatchesType,
  FILE_SIGNATURE_BYTES,
  FILE_TYPES,
  isAllowedContentType,
  MAX_FILE_SIZE_BYTES,
  sanitizeFileName,
} from "@/domain/documents/file-policy";

export const DOCUMENT_FILE_AUDIT_ACTIONS = {
  uploaded: "document_file.uploaded",
  rejected: "document_file.rejected",
  downloaded: "document_file.downloaded",
  deleted: "document_file.deleted",
} as const;

/** Tempo para o navegador concluir o envio depois de pedir a URL. */
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** Link de download curto: vale para abrir agora, não para compartilhar. */
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const ACCEPTED_TYPES_MESSAGE = `tipo de arquivo não aceito: use ${ALLOWED_CONTENT_TYPES.map((type) => FILE_TYPES[type].label).join(", ")}`;

export const uploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1, { error: "informe o nome do arquivo" }).max(255),
    contentType: z.string().trim().refine(isAllowedContentType, { error: ACCEPTED_TYPES_MESSAGE }),
    sizeBytes: z
      .number({ error: "informe o tamanho do arquivo" })
      .int()
      .min(1, { error: "o arquivo está vazio" })
      .max(MAX_FILE_SIZE_BYTES, { error: `o arquivo pode ter até ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB` }),
  })
  .refine((value) => !isAllowedContentType(value.contentType) || extensionMatchesType(value.fileName, value.contentType), {
    error: "a extensão do nome não corresponde ao tipo do arquivo",
    path: ["fileName"],
  });

/** O que a API mostra de um arquivo: nunca a chave interna do objeto. */
export interface DocumentFileView {
  readonly id: string;
  readonly documentId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly status: DocumentFileRecord["status"];
  readonly uploadedBy: { readonly userId: string; readonly name: string };
  readonly availableAt: Date | null;
  readonly createdAt: Date;
}

/** Lista explícita: campo novo no registro não vaza para a API por acidente. */
const toView = (file: DocumentFileRecord): DocumentFileView => ({
  id: file.id,
  documentId: file.documentId,
  fileName: file.fileName,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  status: file.status,
  uploadedBy: file.uploadedBy,
  availableAt: file.availableAt,
  createdAt: file.createdAt,
});

export type FileResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: "invalid_input"; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly reason: "not_found" | "storage_unavailable" };

const invalid = (issues: readonly ValidationIssue[]): FileResult<never> => ({ ok: false, reason: "invalid_input", issues });

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

/**
 * Arquivos dos documentos (MASTER SPEC 7.4, 7.5 e 8).
 *
 * Envio em três passos, sem o arquivo passar pelo servidor da aplicação:
 * 1. o servidor confere o que foi declarado e emite um formulário assinado;
 * 2. o navegador envia o arquivo direto ao bucket privado;
 * 3. o servidor confere o que chegou — tamanho e assinatura do conteúdo — e
 *    só então o arquivo fica disponível. O que não confere é apagado.
 *
 * Download só por URL assinada de poucos minutos, emitida depois da
 * autorização, e registrado na auditoria.
 */
export function createDocumentFileManagement(deps: {
  readonly repository: DocumentFileRepository;
  /** `null` quando o storage não está configurado no ambiente. */
  readonly storage: StorageProvider | null;
  readonly audit: AuditLogger;
  readonly now: () => Date;
  readonly newId: () => string;
}) {
  const record = (
    context: AuthorizedContext,
    request: RequestContext,
    action: string,
    file: DocumentFileRecord,
    metadata: Readonly<Record<string, string | number | boolean | null>> = {},
  ) =>
    deps.audit.record({
      companyId: context.companyId,
      actorUserId: context.userId,
      action,
      entityType: "DocumentFile",
      entityId: file.id,
      metadata: { documentId: file.documentId, contentType: file.contentType, sizeBytes: file.sizeBytes, ...metadata },
      ...auditContext(request),
    });

  return {
    isEnabled: () => deps.storage !== null,

    async requestUpload(
      context: AuthorizedContext,
      documentId: string,
      rawInput: unknown,
    ): Promise<FileResult<{ readonly file: DocumentFileView; readonly upload: UploadForm }>> {
      const storage = deps.storage;
      if (!storage) return { ok: false, reason: "storage_unavailable" };

      const input = uploadRequestSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      if (!(await deps.repository.documentExists(context.companyId, documentId))) {
        return { ok: false, reason: "not_found" };
      }

      const now = deps.now();
      const id = deps.newId();
      const contentType = input.data.contentType as AllowedContentType;
      const objectKey = buildObjectKey({ companyId: context.companyId, documentId, fileId: id });

      const file = await deps.repository.createPending({
        id,
        companyId: context.companyId,
        documentId,
        objectKey,
        fileName: sanitizeFileName(input.data.fileName),
        contentType,
        sizeBytes: input.data.sizeBytes,
        uploadedById: context.userId,
        uploadExpiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1000),
      });

      const upload = await storage.createUploadForm({
        companyId: context.companyId,
        objectKey,
        contentType,
        maxSizeBytes: MAX_FILE_SIZE_BYTES,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      });

      return { ok: true, data: { file: toView(file), upload } };
    },

    /**
     * Conferência depois do envio. Idempotente: concluir um arquivo que já
     * está disponível devolve o mesmo arquivo.
     */
    async completeUpload(
      context: AuthorizedContext,
      documentId: string,
      fileId: string,
      request: RequestContext,
    ): Promise<FileResult<DocumentFileView>> {
      const storage = deps.storage;
      if (!storage) return { ok: false, reason: "storage_unavailable" };

      const file = await deps.repository.findFile(context.companyId, documentId, fileId);
      if (!file || file.status === "REJECTED") return { ok: false, reason: "not_found" };
      if (file.status === "AVAILABLE") return { ok: true, data: toView(file) };

      const location = { companyId: context.companyId, objectKey: file.objectKey };
      const stored = await storage.headObject(location);
      if (!stored) return invalid([{ field: "file", message: "o arquivo ainda não chegou ao armazenamento" }]);

      const contentType = file.contentType as AllowedContentType;
      let reason: string | null = null;
      if (stored.sizeBytes !== file.sizeBytes) {
        reason = "o tamanho recebido é diferente do informado";
      } else if (!contentMatchesType(await storage.readObjectStart({ ...location, bytes: FILE_SIGNATURE_BYTES }), contentType)) {
        reason = `o conteúdo não é um arquivo ${FILE_TYPES[contentType].label} válido`;
      }

      if (reason) {
        // Conteúdo que não confere não fica guardado.
        await storage.deleteObject(location);
        await deps.repository.markRejected(context.companyId, file.id, reason);
        await record(context, request, DOCUMENT_FILE_AUDIT_ACTIONS.rejected, file, { reason });
        return invalid([{ field: "file", message: reason }]);
      }

      const available = await deps.repository.markAvailable(context.companyId, file.id, deps.now());
      // Duas conclusões simultâneas: a primeira marcou, a segunda só relê.
      const result = available ?? (await deps.repository.findFile(context.companyId, documentId, fileId));
      if (!result) return { ok: false, reason: "not_found" };

      if (available) await record(context, request, DOCUMENT_FILE_AUDIT_ACTIONS.uploaded, available);
      return { ok: true, data: toView(result) };
    },

    async list(context: AuthorizedContext, documentId: string): Promise<DocumentFileView[] | null> {
      if (!(await deps.repository.documentExists(context.companyId, documentId))) return null;
      return (await deps.repository.listAvailable(context.companyId, documentId)).map(toView);
    },

    async download(
      context: AuthorizedContext,
      documentId: string,
      fileId: string,
      request: RequestContext,
    ): Promise<FileResult<SignedUrl>> {
      const storage = deps.storage;
      if (!storage) return { ok: false, reason: "storage_unavailable" };

      const file = await deps.repository.findFile(context.companyId, documentId, fileId);
      if (!file || file.status !== "AVAILABLE") return { ok: false, reason: "not_found" };

      const url = await storage.createSignedDownloadUrl({
        companyId: context.companyId,
        objectKey: file.objectKey,
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        fileName: file.fileName,
        contentType: file.contentType,
      });
      await record(context, request, DOCUMENT_FILE_AUDIT_ACTIONS.downloaded, file);
      return { ok: true, data: url };
    },

    /**
     * Exclusão lógica: o arquivo sai do documento, mas o objeto continua no
     * bucket. O storage não tem versionamento — apagar seria irreversível —,
     * então nada é apagado automaticamente (MASTER SPEC 17.2).
     */
    async remove(
      context: AuthorizedContext,
      documentId: string,
      fileId: string,
      request: RequestContext,
    ): Promise<FileResult<null>> {
      const file = await deps.repository.findFile(context.companyId, documentId, fileId);
      if (!file || file.status !== "AVAILABLE") return { ok: false, reason: "not_found" };

      const deleted = await deps.repository.softDelete(context.companyId, documentId, fileId, deps.now());
      if (!deleted) return { ok: false, reason: "not_found" };

      await record(context, request, DOCUMENT_FILE_AUDIT_ACTIONS.deleted, file);
      return { ok: true, data: null };
    },
  };
}

export type DocumentFileManagement = ReturnType<typeof createDocumentFileManagement>;
