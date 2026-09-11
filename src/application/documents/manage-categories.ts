import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import { type ValidationIssue, type WriteResult } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import {
  type CategoryRecord,
  CategoryCycleError,
  CategoryDepthExceededError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  type DocumentRepository,
} from "@/application/ports/document-repository";
import { MAX_CATEGORY_DEPTH, pathOf, toNodeMap } from "@/domain/documents/category-tree";

export const CATEGORY_AUDIT_ACTIONS = {
  created: "category.created",
  updated: "category.updated",
  deleted: "category.deleted",
} as const;

/** Campo opcional: ausente, nulo ou string vazia viram `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal("").transform(() => null), schema])
    .nullish()
    .transform((value) => value ?? null);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, { error: "informe o nome da categoria" }).max(120),
  description: optional(z.string().trim().max(500)),
  parentId: optional(z.uuid({ error: "categoria superior não encontrada" })),
});

export interface CategoryView extends CategoryRecord {
  /** Caminho completo, da raiz até ela: ["Pessoal", "Admissão"]. */
  readonly path: readonly string[];
  readonly depth: number;
}

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const invalid = (issues: readonly ValidationIssue[]): WriteResult<never> => ({
  ok: false,
  reason: "invalid_input",
  issues,
});

const parentIssue = (message: string) => invalid([{ field: "parentId", message }]);

/**
 * Categorias de documentos (MASTER SPEC 10.1): árvore de até
 * MAX_CATEGORY_DEPTH níveis, com nome único entre irmãs. Como sempre, a
 * empresa vem do `AuthorizedContext` e cada escrita gera auditoria.
 */
export function createCategoryManagement(deps: {
  readonly repository: DocumentRepository;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  const record = (context: AuthorizedContext, request: RequestContext, action: string, categoryId: string) =>
    deps.audit.record({
      companyId: context.companyId,
      actorUserId: context.userId,
      action,
      entityType: "DocumentCategory",
      entityId: categoryId,
      ...auditContext(request),
    });

  /** Caminho e nível saem da árvore inteira da empresa, montada uma vez. */
  const withPaths = (categories: readonly CategoryRecord[]): CategoryView[] => {
    const nodes = toNodeMap(categories);
    const names = new Map(categories.map((category) => [category.id, category.name]));
    return categories.map((category) => {
      const path = pathOf(category.id, names, nodes);
      return { ...category, path, depth: path.length };
    });
  };

  const failure = (error: unknown): WriteResult<never> => {
    if (error instanceof CategoryNotFoundError) return parentIssue("categoria superior não encontrada");
    if (error instanceof CategoryNameTakenError) return { ok: false, reason: "conflict" };
    if (error instanceof CategoryDepthExceededError) {
      return parentIssue(`as categorias vão até ${MAX_CATEGORY_DEPTH} níveis`);
    }
    if (error instanceof CategoryCycleError) return parentIssue("uma categoria não pode ficar dentro dela mesma");
    throw error;
  };

  return {
    async list(context: AuthorizedContext): Promise<CategoryView[]> {
      const categories = await deps.repository.listCategories(context.companyId);
      return withPaths(categories).sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
    },

    async find(context: AuthorizedContext, categoryId: string): Promise<CategoryView | null> {
      const category = await deps.repository.findCategory(context.companyId, categoryId);
      if (!category) return null;
      // O caminho depende das ancestrais: precisa da árvore da empresa.
      return withPaths(await deps.repository.listCategories(context.companyId)).find((item) => item.id === category.id) ?? null;
    },

    async create(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<CategoryRecord>> {
      const input = categoryInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const category = await deps.repository.createCategory(context.companyId, input.data);
        await record(context, request, CATEGORY_AUDIT_ACTIONS.created, category.id);
        return { ok: true, data: category };
      } catch (error) {
        return failure(error);
      }
    },

    async update(
      context: AuthorizedContext,
      categoryId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<CategoryRecord>> {
      const input = categoryInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      try {
        const category = await deps.repository.updateCategory(context.companyId, categoryId, input.data);
        if (!category) return { ok: false, reason: "not_found" };
        await record(context, request, CATEGORY_AUDIT_ACTIONS.updated, category.id);
        return { ok: true, data: category };
      } catch (error) {
        return failure(error);
      }
    },

    async remove(
      context: AuthorizedContext,
      categoryId: string,
      request: RequestContext,
    ): Promise<WriteResult<null>> {
      const result = await deps.repository.deleteCategory(context.companyId, categoryId, deps.now());
      if (result === "not_found") return { ok: false, reason: "not_found" };
      if (result === "in_use") return { ok: false, reason: "in_use" };

      await record(context, request, CATEGORY_AUDIT_ACTIONS.deleted, categoryId);
      return { ok: true, data: null };
    },
  };
}

export type CategoryManagement = ReturnType<typeof createCategoryManagement>;
