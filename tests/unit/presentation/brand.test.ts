import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ASSETS, BRAND_COLORS, BRAND_SURFACES } from "@/presentation/brand";

const root = process.cwd();

/** Largura e altura de um PNG a partir do cabeçalho IHDR. */
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("identidade visual", () => {
  it("usa a paleta oficial do quadro da marca", () => {
    expect(BRAND_COLORS).toEqual({ primary: "#3D5AFE", dark: "#2541B2", cyan: "#00E5FF" });
  });

  it("os tokens de cor do CSS correspondem à paleta e às superfícies", () => {
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8").toLowerCase();

    expect(css).toContain(`--brand-primary: ${BRAND_COLORS.primary.toLowerCase()}`);
    expect(css).toContain(`--brand-dark: ${BRAND_COLORS.dark.toLowerCase()}`);
    expect(css).toContain(`--brand-cyan: ${BRAND_COLORS.cyan.toLowerCase()}`);
    expect(css).toContain(`--surface-light: ${BRAND_SURFACES.light.toLowerCase()}`);
    expect(css).toContain(`--surface-dark: ${BRAND_SURFACES.dark.toLowerCase()}`);
  });

  it.each(Object.entries(BRAND_ASSETS))("o arquivo de %s existe com as dimensões declaradas", (_name, asset) => {
    expect(pngSize(path.join(root, "public", asset.src))).toEqual({ width: asset.width, height: asset.height });
  });

  it("publica favicon, ícone e apple-icon pelas convenções do Next.js", () => {
    expect(pngSize(path.join(root, "src/app/icon.png"))).toEqual({ width: 192, height: 192 });
    expect(pngSize(path.join(root, "src/app/apple-icon.png"))).toEqual({ width: 180, height: 180 });
    const ico = readFileSync(path.join(root, "src/app/favicon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3);
  });
});
