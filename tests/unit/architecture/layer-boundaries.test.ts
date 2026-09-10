import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garante as fronteiras do monólito modular:
 *
 *   app (rotas Next.js / composição) → presentation, application, infrastructure
 *   presentation → application, domain
 *   infrastructure → application (portas), domain
 *   application → domain
 *   domain → (nada interno)
 */

const SRC_DIR = path.resolve(process.cwd(), "src");

type Layer = "app" | "presentation" | "application" | "domain" | "infrastructure" | "generated";

const RULES: Record<"domain" | "application" | "presentation", {
  forbiddenLayers: readonly Layer[];
  allowedPackages: readonly string[] | "any";
}> = {
  domain: {
    forbiddenLayers: ["app", "presentation", "application", "infrastructure", "generated"],
    allowedPackages: ["zod"],
  },
  application: {
    forbiddenLayers: ["app", "presentation", "infrastructure", "generated"],
    allowedPackages: ["zod"],
  },
  presentation: {
    forbiddenLayers: ["app", "infrastructure", "generated"],
    allowedPackages: "any",
  },
};

const IMPORT_PATTERN = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g;

export function extractImports(source: string): string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => (match[1] ?? match[2]) as string);
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] as string);
}

function classify(specifier: string, fromFile: string): { layer: Layer | null } | { pkg: string } {
  let target: string;
  if (specifier.startsWith("@/")) {
    target = path.join(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    target = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return { pkg: packageName(specifier) };
  }
  const relative = path.relative(SRC_DIR, target);
  const firstSegment = relative.split(path.sep)[0] as Layer;
  return { layer: relative.startsWith("..") ? null : firstSegment };
}

function sourceFiles(layer: string): string[] {
  return readdirSync(path.join(SRC_DIR, layer), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("fronteiras de camadas", () => {
  it("o extrator detecta imports estáticos, dinâmicos e side-effect", () => {
    const source = [
      'import { a } from "@/infrastructure/x";',
      'import type { B } from "../application/y";',
      'import "server-only";',
      'export * from "./z";',
      'const m = await import("@prisma/client");',
    ].join("\n");

    expect(extractImports(source)).toEqual([
      "@/infrastructure/x",
      "../application/y",
      "server-only",
      "./z",
      "@prisma/client",
    ]);
  });

  it.each(Object.keys(RULES) as Array<keyof typeof RULES>)(
    "%s respeita suas dependências permitidas",
    (layer) => {
      const rule = RULES[layer];
      const files = sourceFiles(layer);
      const violations: string[] = [];

      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        for (const specifier of extractImports(readFileSync(file, "utf8"))) {
          const target = classify(specifier, file);
          const where = `${path.relative(SRC_DIR, file)} → ${specifier}`;

          if ("pkg" in target) {
            if (rule.allowedPackages !== "any" && !rule.allowedPackages.includes(target.pkg)) {
              violations.push(`${where} (pacote externo não permitido)`);
            }
          } else if (target.layer === null || rule.forbiddenLayers.includes(target.layer)) {
            violations.push(`${where} (camada proibida)`);
          }
        }
      }

      expect(violations).toEqual([]);
    },
  );
});
