/** Apoio das telas de documentos: o que a pessoa digita ↔ o que a API espera. */

export interface DocumentFilters {
  readonly q: string;
  readonly categoryId: string;
  readonly tag: string;
  readonly responsibleUserId: string;
  /** Situação de vencimento; só aparece com o módulo Controle de vencimentos. */
  readonly status: string;
  readonly sort: "recent" | "title" | "created" | "expiration";
  readonly page: number;
}

export const EMPTY_FILTERS: DocumentFilters = {
  q: "",
  categoryId: "",
  tag: "",
  responsibleUserId: "",
  status: "",
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
  if (filters.status) params.set("status", filters.status);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** Situação de vencimento como a pessoa lê (MASTER SPEC 10.2). */
export const EXPIRATION_LABELS: Readonly<Record<string, string>> = {
  VALID: "Em dia",
  EXPIRING: "Vence em breve",
  EXPIRED: "Vencido",
  NO_EXPIRATION: "Sem validade",
};

/** Cores por situação: vermelho para vencido, âmbar para o alerta, verde para em dia. */
export const EXPIRATION_CHIPS: Readonly<Record<string, string>> = {
  VALID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  EXPIRING: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  NO_EXPIRATION: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/** "vence em 12 dias", "venceu há 3 dias", "vence hoje". */
export function expirationPhrase(daysRemaining: number): string {
  if (daysRemaining === 0) return "vence hoje";
  if (daysRemaining > 0) return `vence em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`;
  const days = Math.abs(daysRemaining);
  return `venceu há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** "1-20 de 37" — ou a frase de lista vazia. */
export function pageSummary(total: number, page: number, pageSize: number): string {
  if (total === 0) return "Nenhum documento encontrado";
  const first = (page - 1) * pageSize + 1;
  return `${first}-${Math.min(first + pageSize - 1, total)} de ${total}`;
}
