const SLUG_BASE_MAX_LENGTH = 60;

/** Converte o nome da empresa em um trecho de URL: sem acentos, minúsculo, com hífens. */
export function slugifyCompanyName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/, "");

  return base || "empresa";
}

/** Slug único: nome legível + sufixo aleatório (evita colisão e enumeração por nome). */
export function buildCompanySlug(name: string, randomSuffix: string): string {
  if (!/^[a-z0-9]{6,12}$/.test(randomSuffix)) {
    throw new Error("sufixo de slug inválido");
  }
  return `${slugifyCompanyName(name)}-${randomSuffix}`;
}
