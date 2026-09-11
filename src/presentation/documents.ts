/** Apoio das telas de documentos: o que a pessoa digita ↔ o que a API espera. */

export interface DocumentFilters {
  readonly q: string;
  readonly categoryId: string;
  readonly tag: string;
  readonly responsibleUserId: string;
  readonly sort: "recent" | "title" | "created";
  readonly page: number;
}

export const EMPTY_FILTERS: DocumentFilters = {
  q: "",
  categoryId: "",
  tag: "",
  responsibleUserId: "",
  sort: "recent",
  page: 1,
};

/** Etiquetas separadas por vírgula, como a pessoa escreve no formulário. */
export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

export function formatTagsInput(tags: readonly string[]): string {
  return tags.join(", ");
}

/** Só o que está preenchido vai para a URL: parâmetro vazio confunde a leitura. */
export function documentsQuery(filters: DocumentFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== "") params.set("q", filters.q.trim());
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.responsibleUserId) params.set("responsibleUserId", filters.responsibleUserId);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** "1-20 de 37" — ou a frase de lista vazia. */
export function pageSummary(total: number, page: number, pageSize: number): string {
  if (total === 0) return "Nenhum documento encontrado";
  const first = (page - 1) * pageSize + 1;
  return `${first}-${Math.min(first + pageSize - 1, total)} de ${total}`;
}
