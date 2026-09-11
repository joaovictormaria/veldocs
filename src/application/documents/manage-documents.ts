import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue, WriteResult } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import {
  type DocumentInput,
  type DocumentPage,
  type DocumentRecord,
  DocumentReferenceError,
  type DocumentRepository,
  type TagRecord,
} from "@/application/ports/document-repository";
import { calendarDateSchema } from "@/domain/documents/document-dates";
import { normalizeSearchText, searchTerms } from "@/domain/documents/search-text";
import { MAX_TAG_LENGTH, MAX_TAGS_PER_DOCUMENT, prepareTags } from "@/domain/documents/tags";

export const DOCUMENT_AUDIT_ACTIONS = {
  created: "document.created",
  updated: "document.updated",
  deleted: "document.deleted",
} as const;

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/** Campo opcional: ausente, nulo ou string vazia viram `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal("").transform(() => null), schema])
    .nullish()
    .transform((value) => value ?? null);

const reference = (message: string) => optional(z.uuid({ error: message }));

export const documentInputSchema = z
  .object({
    title: z.string().trim().min(2, { error: "informe o título do documento" }).max(255),
    description: optional(z.string().trim().max(5000)),
    categoryId: reference("categoria não encontrada"),
    branchId: reference("filial não encontrada"),
    departmentId: reference("setor não encontrado"),
    responsibleUserId: reference("responsável não encontrado"),
    issueDate: optional(calendarDateSchema),
    expirationDate: optional(calendarDateSchema),
    tags: z
      .array(z.string().trim().max(MAX_TAG_LENGTH, { error: `etiqueta com até ${MAX_TAG_LENGTH} caracteres` }))
      .max(MAX_TAGS_PER_DOCUMENT, { error: `até ${MAX_TAGS_PER_DOCUMENT} etiquetas por documento` })
      .default([]),
  })
  .refine((value) => !value.issueDate || !value.expirationDate || value.expirationDate >= value.issueDate, {
    error: "a validade não pode ser anterior à emissão",
    path: ["expirationDate"],
  });

export const documentQuerySchema = z.object({
  q: optional(z.string().trim().max(100)),
  categoryId: reference("categoria não encontrada"),
  tag: optional(z.string().trim().max(MAX_TAG_LENGTH)),
  responsibleUserId: reference("responsável não encontrado"),
  branchId: reference("filial não encontrada"),
  departmentId: reference("setor não encontrado"),
  sort: z.enum(["recent", "title", "created"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const invalid = (issues: readonly ValidationIssue[]): WriteResult<never> => ({
  ok: false,
  reason: "invalid_input",
  issues,
});

/** Parâmetros vazios na URL (`?tag=`) valem como ausentes. */
const withoutEmptyValues = (raw: unknown): unknown =>
  typeof raw === "object" && raw !== null
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, value]) => value !== ""))
    : raw;

/** Campos que mudaram, para a auditoria dizer o que foi editado sem guardar conteúdo. */
function changedFields(before: DocumentRecord, after: DocumentInput): string[] {
  const changed: string[] = [];
  const compare: Array<[string, unknown, unknown]> = [
    ["title", before.title, after.title],
    ["description", before.description, after.description],
    ["categoryId", before.category?.id ?? null, after.categoryId],
    ["branchId", before.branch?.id ?? null, after.branchId],
    ["departmentId", before.department?.id ?? null, after.departmentId],
    ["responsibleUserId", before.responsible?.userId ?? null, after.responsibleUserId],
    ["issueDate", before.issueDate, after.issueDate],
    ["expirationDate", before.expirationDate, after.expirationDate],
    ["tags", before.tags.join("|"), prepareTags(after.tags).map((tag) => tag.name).join("|")],
  ];

  for (const [field, previous, next] of compare) {
    if (previous !== next) changed.push(field);
  }
  return changed;
}

/**
 * Documentos da empresa ativa (MASTER SPEC 10.1): metadados, responsável,
 * categoria, filial, setor, datas e etiquetas, com busca e filtros. O arquivo
 * em si pertence à FASE 5 (storage) — aqui só existem os metadados.
 */
export function createDocumentManagement(deps: {
  readonly repository: DocumentRepository;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  const record = (
    context: AuthorizedContext,
    request: RequestContext,
    action: string,
    documentId: string,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ) =>
    deps.audit.record({
      companyId: context.companyId,
      actorUserId: context.userId,
      action,
      entityType: "Document",
      entityId: documentId,
      metadata,
      ...auditContext(request),
    });

  const failure = (error: unknown): WriteResult<never> => {
    if (error instanceof DocumentReferenceError) return invalid([{ field: error.field, message: error.message }]);
    throw error;
  };

  return {
    async list(context: AuthorizedContext, rawQuery: unknown): Promise<WriteResult<DocumentPage>> {
      const query = documentQuerySchema.safeParse(withoutEmptyValues(rawQuery));
      if (!query.success) return invalid(issuesOf(query.error));

      const { q, tag, ...rest } = query.data;
      const page = await deps.repository.listDocuments(context.companyId, {
        ...rest,
        terms: q ? searchTerms(q) : [],
        tag: tag ? normalizeSearchText(tag) : null,
      });
      return { ok: true, data: page };
    },

    find: (context: AuthorizedContext, documentId: string) =>
      deps.repository.findDocument(context.companyId, documentId),

    listTags: (context: AuthorizedContext): Promise<TagRecord[]> => deps.repository.listTags(context.companyId),

    async create(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<DocumentRecord>> {
      const input = documentInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const document = await deps.repository.createDocument(
          context.companyId,
          input.data,
          context.userId,
          deps.now(),
        );
        await record(context, request, DOCUMENT_AUDIT_ACTIONS.created, document.id, {
          categoryId: document.category?.id ?? null,
          branchId: document.branch?.id ?? null,
          departmentId: document.department?.id ?? null,
          responsibleUserId: document.responsible?.userId ?? null,
          tagCount: document.tags.length,
          hasExpiration: document.expirationDate !== null,
        });
        return { ok: true, data: document };
      } catch (error) {
        return failure(error);
      }
    },

    async update(
      context: AuthorizedContext,
      documentId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<DocumentRecord>> {
      const input = documentInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const before = await deps.repository.findDocument(context.companyId, documentId);
      if (!before) return { ok: false, reason: "not_found" };

      try {
        const document = await deps.repository.updateDocument(
          context.companyId,
          documentId,
          input.data,
          deps.now(),
        );
        if (!document) return { ok: false, reason: "not_found" };

        await record(context, request, DOCUMENT_AUDIT_ACTIONS.updated, document.id, {
          changedFields: changedFields(before, input.data).join(","),
        });
        return { ok: true, data: document };
      } catch (error) {
        return failure(error);
      }
    },

    async remove(context: AuthorizedContext, documentId: string, request: RequestContext): Promise<WriteResult<null>> {
      const deleted = await deps.repository.deleteDocument(context.companyId, documentId, deps.now());
      if (!deleted) return { ok: false, reason: "not_found" };

      await record(context, request, DOCUMENT_AUDIT_ACTIONS.deleted, documentId, {});
      return { ok: true, data: null };
    },
  };
}

export type DocumentManagement = ReturnType<typeof createDocumentManagement>;
