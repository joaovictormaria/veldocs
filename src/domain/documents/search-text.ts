/**
 * Busca documental sem depender de acentuação (MASTER SPEC 10.1). O texto é
 * normalizado na gravação e na consulta, então "Certidão" encontra "certidao"
 * sem precisar de extensão do PostgreSQL (`unaccent`), que exigiria privilégio
 * de superusuário no banco gerenciado.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Quantos termos de uma busca são considerados: o resto é ignorado. */
export const MAX_SEARCH_TERMS = 6;

/** Termos da busca; o documento precisa conter TODOS eles. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized === "" ? [] : normalized.split(" ").slice(0, MAX_SEARCH_TERMS);
}

/** Texto pesquisável do documento: título, descrição e etiquetas juntos. */
export function buildSearchText(document: {
  readonly title: string;
  readonly description?: string | null;
  readonly tags?: readonly string[];
}): string {
  return normalizeSearchText([document.title, document.description ?? "", ...(document.tags ?? [])].join(" "));
}
