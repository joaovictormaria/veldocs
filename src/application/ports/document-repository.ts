import type { ExpirationStatus } from "@/domain/documents/expiration";

/** Categoria superior inexistente, de outra empresa ou já excluída. */
export class CategoryNotFoundError extends Error {
  constructor() {
    super("categoria não encontrada");
    this.name = "CategoryNotFoundError";
  }
}

/** Já existe categoria viva com o mesmo nome sob a mesma categoria superior. */
export class CategoryNameTakenError extends Error {
  constructor() {
    super("categoria já existe");
    this.name = "CategoryNameTakenError";
  }
}

/** A movimentação passaria do limite de níveis (MAX_CATEGORY_DEPTH). */
export class CategoryDepthExceededError extends Error {
  constructor() {
    super("limite de níveis de categoria");
    this.name = "CategoryDepthExceededError";
  }
}

/** A categoria ficaria dentro de si mesma ou de uma descendente. */
export class CategoryCycleError extends Error {
  constructor() {
    super("categoria não pode ficar dentro dela mesma");
    this.name = "CategoryCycleError";
  }
}

/** Campo do documento que aponta para um registro inexistente na empresa. */
export type DocumentReferenceField = "categoryId" | "branchId" | "departmentId" | "responsibleUserId";

export class DocumentReferenceError extends Error {
  constructor(
    readonly field: DocumentReferenceField,
    message: string,
  ) {
    super(message);
    this.name = "DocumentReferenceError";
  }
}

export interface CategoryRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
  /** Documentos vivos diretamente nesta categoria (não conta os das filhas). */
  readonly documentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CategoryInput {
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
}

export interface DocumentPerson {
  readonly userId: string;
  readonly name: string;
}

export interface DocumentLink {
  readonly id: string;
  readonly name: string;
}

export interface DocumentRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly category: DocumentLink | null;
  readonly branch: DocumentLink | null;
  readonly department: DocumentLink | null;
  readonly responsible: DocumentPerson | null;
  readonly createdBy: DocumentPerson | null;
  /** `AAAA-MM-DD`: data de calendário, sem fuso (ver domain/documents/document-dates.ts). */
  readonly issueDate: string | null;
  readonly expirationDate: string | null;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DocumentInput {
  readonly title: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly branchId: string | null;
  readonly departmentId: string | null;
  readonly responsibleUserId: string | null;
  readonly issueDate: string | null;
  readonly expirationDate: string | null;
  readonly tags: readonly string[];
}

export type DocumentSort = "recent" | "title" | "created" | "expiration";

export interface DocumentFilter {
  /** Todos os termos precisam aparecer no texto pesquisável do documento. */
  readonly terms: readonly string[];
  readonly categoryId: string | null;
  /** Nome da etiqueta já normalizado. */
  readonly tag: string | null;
  readonly responsibleUserId: string | null;
  readonly branchId: string | null;
  readonly departmentId: string | null;
  /** Situação de vencimento; só chega aqui com o módulo contratado. */
  readonly expirationStatus: ExpirationStatus | null;
  /** Hoje em Brasília (`AAAA-MM-DD`): a situação é comparada com ele. */
  readonly today: string;
  readonly expiringWindowDays: number;
  readonly sort: DocumentSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface ExpirationCounts {
  readonly valid: number;
  readonly expiring: number;
  readonly expired: number;
  readonly withoutExpiration: number;
  readonly total: number;
}

export interface RenewalInput {
  readonly issueDate: string | null;
  readonly expirationDate: string;
}

export interface DocumentPage {
  readonly items: readonly DocumentRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface TagRecord {
  readonly name: string;
  readonly documentCount: number;
}

/**
 * Documentos, categorias e etiquetas da empresa ativa. Toda operação recebe o
 * `companyId` do contexto autorizado: um id de outra empresa simplesmente não
 * é encontrado. Exclusões são lógicas e nada é apagado do banco.
 */
export interface DocumentRepository {
  listCategories(companyId: string): Promise<CategoryRecord[]>;
  findCategory(companyId: string, categoryId: string): Promise<CategoryRecord | null>;
  /**
   * @throws {CategoryNotFoundError} `parentId` não é categoria viva da empresa.
   * @throws {CategoryNameTakenError} nome repetido no mesmo nível.
   * @throws {CategoryDepthExceededError} passaria do limite de níveis.
   */
  createCategory(companyId: string, input: CategoryInput): Promise<CategoryRecord>;
  /** @throws {CategoryCycleError} a categoria ficaria dentro dela mesma. */
  updateCategory(companyId: string, categoryId: string, input: CategoryInput): Promise<CategoryRecord | null>;
  /** Recusa (devolve `false` como "em uso") categoria com filhas ou documentos vivos. */
  deleteCategory(companyId: string, categoryId: string, at: Date): Promise<"deleted" | "not_found" | "in_use">;

  listDocuments(companyId: string, filter: DocumentFilter): Promise<DocumentPage>;
  findDocument(companyId: string, documentId: string): Promise<DocumentRecord | null>;
  /** @throws {DocumentReferenceError} categoria, filial, setor ou responsável inválido. */
  createDocument(companyId: string, input: DocumentInput, createdById: string, at: Date): Promise<DocumentRecord>;
  updateDocument(
    companyId: string,
    documentId: string,
    input: DocumentInput,
    at: Date,
  ): Promise<DocumentRecord | null>;
  deleteDocument(companyId: string, documentId: string, at: Date): Promise<boolean>;

  /**
   * Contagem por situação de vencimento e os documentos que vencem antes
   * (vencidos primeiro), para o painel do módulo Controle de vencimentos.
   */
  summarizeExpirations(
    companyId: string,
    options: { readonly today: string; readonly windowEnd: string; readonly limit: number },
  ): Promise<{ readonly counts: ExpirationCounts; readonly upcoming: readonly DocumentRecord[] }>;

  /** Renovação: troca só as datas do documento, sem mexer no resto. */
  renewDocument(
    companyId: string,
    documentId: string,
    input: RenewalInput,
    at: Date,
  ): Promise<DocumentRecord | null>;

  /** Etiquetas com pelo menos um documento vivo, em ordem alfabética. */
  listTags(companyId: string): Promise<TagRecord[]>;
}
