import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createCategoryManagement } from "@/application/documents/manage-categories";
import { createDocumentManagement } from "@/application/documents/manage-documents";
import {
  type CategoryRecord,
  CategoryCycleError,
  CategoryDepthExceededError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  type DocumentFilter,
  type DocumentRecord,
  DocumentReferenceError,
  type DocumentRepository,
} from "@/application/ports/document-repository";
import { createFakeAudit, createFakeClock } from "../auth/fakes";

const COMPANY = "company-1";
const request = { ipAddress: "203.0.113.11", userAgent: "vitest" };
const at = new Date("2026-09-11T12:00:00.000Z");

const context: AuthorizedContext = {
  companyId: COMPANY,
  userId: "user-1",
  roleKeys: ["ADMIN"],
  permissions: ["categories.manage", "documents.create", "documents.update", "documents.delete"],
};

const documentOf = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: "doc-1",
  title: "Alvará",
  description: null,
  category: null,
  branch: null,
  department: null,
  responsible: null,
  createdBy: { userId: "user-1", name: "Pessoa" },
  issueDate: null,
  expirationDate: null,
  tags: [],
  createdAt: at,
  updatedAt: at,
  ...overrides,
});

/** Repositório em memória: guarda as chamadas e encena as recusas do banco. */
function createFakeRepository() {
  const calls: string[] = [];
  const filters: DocumentFilter[] = [];
  const categories = new Map<string, CategoryRecord>();
  let documents: DocumentRecord[] = [documentOf()];
  let nextError: Error | null = null;

  const raise = () => {
    const error = nextError;
    nextError = null;
    if (error) throw error;
  };

  const repository: DocumentRepository = {
    async listCategories(companyId) {
      calls.push(`listCategories:${companyId}`);
      return [...categories.values()];
    },
    async findCategory(companyId, categoryId) {
      calls.push(`findCategory:${companyId}`);
      return categories.get(categoryId) ?? null;
    },
    async createCategory(companyId, input) {
      calls.push(`createCategory:${companyId}`);
      raise();
      const category: CategoryRecord = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        documentCount: 0,
        createdAt: at,
        updatedAt: at,
      };
      categories.set(category.id, category);
      return category;
    },
    async updateCategory(companyId, categoryId, input) {
      calls.push(`updateCategory:${companyId}`);
      raise();
      const current = categories.get(categoryId);
      if (!current) return null;
      const updated = { ...current, ...input };
      categories.set(categoryId, updated);
      return updated;
    },
    async deleteCategory(companyId, categoryId) {
      calls.push(`deleteCategory:${companyId}`);
      if (!categories.has(categoryId)) return "not_found";
      if ((categories.get(categoryId) as CategoryRecord).documentCount > 0) return "in_use";
      categories.delete(categoryId);
      return "deleted";
    },

    async listDocuments(companyId, filter) {
      calls.push(`listDocuments:${companyId}`);
      filters.push(filter);
      return { items: documents, total: documents.length, page: filter.page, pageSize: filter.pageSize };
    },
    async findDocument(companyId, documentId) {
      calls.push(`findDocument:${companyId}`);
      return documents.find((document) => document.id === documentId) ?? null;
    },
    async createDocument(companyId, input, createdById) {
      calls.push(`createDocument:${companyId}`);
      raise();
      const created = documentOf({
        id: randomUUID(),
        title: input.title,
        description: input.description,
        issueDate: input.issueDate,
        expirationDate: input.expirationDate,
        tags: [...input.tags],
        createdBy: { userId: createdById, name: "Pessoa" },
      });
      documents.push(created);
      return created;
    },
    async updateDocument(companyId, documentId, input) {
      calls.push(`updateDocument:${companyId}`);
      raise();
      const current = documents.find((document) => document.id === documentId);
      if (!current) return null;
      const updated = documentOf({ ...current, ...input, tags: [...input.tags] });
      documents = documents.map((document) => (document.id === documentId ? updated : document));
      return updated;
    },
    async deleteDocument(companyId, documentId) {
      calls.push(`deleteDocument:${companyId}`);
      const before = documents.length;
      documents = documents.filter((document) => document.id !== documentId);
      return documents.length < before;
    },

    async listTags(companyId) {
      calls.push(`listTags:${companyId}`);
      return [{ name: "Fiscal", documentCount: 1 }];
    },
  };

  return {
    repository,
    calls,
    filters,
    categories,
    fail: (error: Error) => {
      nextError = error;
    },
  };
}

let fake: ReturnType<typeof createFakeRepository>;
let audit: ReturnType<typeof createFakeAudit>;
let documents: ReturnType<typeof createDocumentManagement>;
let categories: ReturnType<typeof createCategoryManagement>;

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

const refuse = <T>(result: { ok: true; data: T } | { ok: false; reason: string; issues?: unknown }) => {
  if (result.ok) throw new Error("esperava recusa");
  return result;
};

beforeEach(() => {
  fake = createFakeRepository();
  audit = createFakeAudit();
  const deps = { repository: fake.repository, audit: audit.audit, now: createFakeClock().now };
  documents = createDocumentManagement(deps);
  categories = createCategoryManagement(deps);
});

describe("documentos", () => {
  it("cria com os dados informados e audita sem guardar conteúdo", async () => {
    const document = unwrap(
      await documents.create(
        context,
        {
          title: "  Alvará de funcionamento  ",
          description: "",
          issueDate: "2026-01-10",
          expirationDate: "2027-01-09",
          tags: ["Fiscal", "fiscal", " "],
        },
        request,
      ),
    );

    expect(document.title).toBe("Alvará de funcionamento");
    expect(document.description).toBeNull();
    expect(audit.events).toEqual([
      expect.objectContaining({
        companyId: COMPANY,
        actorUserId: "user-1",
        action: "document.created",
        entityType: "Document",
        entityId: document.id,
        metadata: {
          categoryId: null,
          branchId: null,
          departmentId: null,
          responsibleUserId: null,
          tagCount: document.tags.length,
          hasExpiration: true,
        },
      }),
    ]);
    // O título não vai para a auditoria: lá ficam só referências e contagens.
    expect(JSON.stringify(audit.events)).not.toContain("Alvará");
  });

  it("recusa título curto, data inválida e etiquetas demais, sem auditar", async () => {
    const result = refuse(
      await documents.create(
        context,
        { title: "A", issueDate: "10/01/2026", tags: Array.from({ length: 11 }, (_v, i) => `t${i}`) },
        request,
      ),
    );

    expect(result.reason).toBe("invalid_input");
    expect((result.issues as Array<{ field: string }>).map((issue) => issue.field).sort()).toEqual([
      "issueDate",
      "tags",
      "title",
    ]);
    expect(audit.events).toEqual([]);
  });

  it("recusa validade anterior à emissão apontando o campo", async () => {
    const result = refuse(
      await documents.create(context, { title: "Contrato", issueDate: "2026-05-10", expirationDate: "2026-05-09" }, request),
    );

    expect((result.issues as Array<{ field: string; message: string }>)[0]).toEqual({
      field: "expirationDate",
      message: "a validade não pode ser anterior à emissão",
    });
  });

  it("traduz referência inexistente no campo que o formulário mostra", async () => {
    fake.fail(new DocumentReferenceError("responsibleUserId", "responsável não encontrado"));

    const result = refuse(await documents.create(context, { title: "Contrato", responsibleUserId: randomUUID() }, request));

    expect(result.reason).toBe("invalid_input");
    expect(result.issues).toEqual([{ field: "responsibleUserId", message: "responsável não encontrado" }]);
    expect(audit.events).toEqual([]);
  });

  it("audita a edição dizendo quais campos mudaram", async () => {
    await documents.update(context, "doc-1", { title: "Alvará", tags: ["Fiscal"], description: "Prefeitura" }, request);

    expect(audit.events.at(-1)).toEqual(
      expect.objectContaining({ action: "document.updated", metadata: { changedFields: "description,tags" } }),
    );
  });

  it("editar documento inexistente não audita", async () => {
    expect(await documents.update(context, randomUUID(), { title: "Contrato" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(audit.events).toEqual([]);
  });

  it("exclui e audita; excluir de novo é not_found", async () => {
    expect(await documents.remove(context, "doc-1", request)).toEqual({ ok: true, data: null });
    expect(audit.events.at(-1)?.action).toBe("document.deleted");

    audit.events.length = 0;
    expect(await documents.remove(context, "doc-1", request)).toEqual({ ok: false, reason: "not_found" });
    expect(audit.events).toEqual([]);
  });
});

describe("busca e filtros", () => {
  it("usa os padrões quando nada é informado", async () => {
    unwrap(await documents.list(context, {}));

    expect(fake.filters.at(-1)).toEqual({
      terms: [],
      categoryId: null,
      tag: null,
      responsibleUserId: null,
      branchId: null,
      departmentId: null,
      sort: "recent",
      page: 1,
      pageSize: 20,
    });
  });

  it("normaliza a busca e a etiqueta, e trata parâmetro vazio como ausente", async () => {
    unwrap(await documents.list(context, { q: " Certidão  Negativa ", tag: "FISCAL", categoryId: "", sort: "title", page: "2" }));

    expect(fake.filters.at(-1)).toMatchObject({
      terms: ["certidao", "negativa"],
      tag: "fiscal",
      categoryId: null,
      sort: "title",
      page: 2,
    });
  });

  it("recusa paginação e ordenação fora do permitido", async () => {
    const result = refuse(await documents.list(context, { page: "0", pageSize: "500", sort: "aleatorio" }));

    expect((result.issues as Array<{ field: string }>).map((issue) => issue.field).sort()).toEqual([
      "page",
      "pageSize",
      "sort",
    ]);
  });
});

describe("categorias", () => {
  it("traz o caminho completo e o nível de cada categoria", async () => {
    const raiz = unwrap(await categories.create(context, { name: "Pessoal" }, request));
    const filha = unwrap(await categories.create(context, { name: "Admissão", parentId: raiz.id }, request));

    const listed = await categories.list(context);

    expect(listed.find((item) => item.id === filha.id)).toMatchObject({
      path: ["Pessoal", "Admissão"],
      depth: 2,
    });
    expect(audit.events.map((event) => event.action)).toEqual(["category.created", "category.created"]);
  });

  it("traduz cada recusa do banco na resposta certa", async () => {
    const cases = [
      [new CategoryNotFoundError(), "invalid_input", "categoria superior não encontrada"],
      [new CategoryDepthExceededError(), "invalid_input", "as categorias vão até 3 níveis"],
      [new CategoryCycleError(), "invalid_input", "uma categoria não pode ficar dentro dela mesma"],
    ] as const;

    for (const [error, reason, message] of cases) {
      fake.fail(error);
      const result = refuse(await categories.create(context, { name: "Qualquer", parentId: randomUUID() }, request));
      expect(result.reason).toBe(reason);
      expect(result.issues).toEqual([{ field: "parentId", message }]);
    }

    fake.fail(new CategoryNameTakenError());
    expect(await categories.create(context, { name: "Repetida" }, request)).toEqual({ ok: false, reason: "conflict" });
    expect(audit.events).toEqual([]);
  });

  it("não exclui categoria com documentos", async () => {
    const category = unwrap(await categories.create(context, { name: "Fiscal" }, request));
    fake.categories.set(category.id, { ...category, documentCount: 3 });
    audit.events.length = 0;

    expect(await categories.remove(context, category.id, request)).toEqual({ ok: false, reason: "in_use" });
    expect(audit.events).toEqual([]);
  });
});

describe("escopo por empresa", () => {
  it("o repositório só recebe a empresa do contexto autorizado", async () => {
    await documents.list(context, {});
    await documents.listTags(context);
    await documents.create(context, { title: "Contrato" }, request);
    await categories.list(context);

    expect(fake.calls).toEqual([
      `listDocuments:${COMPANY}`,
      `listTags:${COMPANY}`,
      `createDocument:${COMPANY}`,
      `listCategories:${COMPANY}`,
    ]);
  });
});
