/**
 * Identidade visual oficial do VELDOCS (fonte: docs/brand/VELDOCS-logo.pdf).
 * Detalhes de uso em docs/brand/identidade-visual.md.
 */
export const BRAND_COLORS = {
  /** Azul principal */
  primary: "#3D5AFE",
  /** Azul escuro */
  dark: "#2541B2",
  /** Ciano */
  cyan: "#00E5FF",
} as const;

/** Fundos dos painéis claro e escuro do quadro da marca (as logos foram recortadas deles). */
export const BRAND_SURFACES = {
  light: "#FBFAFA",
  dark: "#121317",
} as const;

export const BRAND_ASSETS = {
  logoLight: { src: "/brand/veldocs-logo-light.png", width: 470, height: 186 },
  logoDark: { src: "/brand/veldocs-logo-dark.png", width: 476, height: 186 },
  icon: { src: "/brand/veldocs-icon.png", width: 158, height: 158 },
} as const;
