import { normalizeSearchText } from "./search-text";

export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS_PER_DOCUMENT = 10;

export interface PreparedTag {
  /** Como a pessoa escreveu, com espaços normalizados. */
  readonly name: string;
  /** Minúsculas e sem acentos: identidade da etiqueta dentro da empresa. */
  readonly key: string;
}

/** Espaços das pontas e repetidos somem; o resto é preservado. */
export function normalizeTagName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Etiquetas de um documento: vazias saem, repetidas somem (a primeira grafia
 * vence) e a ordem final é sempre a mesma, para a comparação não depender de
 * como a lista chegou.
 */
export function prepareTags(values: readonly string[]): PreparedTag[] {
  const byKey = new Map<string, PreparedTag>();

  for (const value of values) {
    const name = normalizeTagName(value);
    const key = normalizeSearchText(name);
    if (key === "" || byKey.has(key)) continue;
    byKey.set(key, { name, key });
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
