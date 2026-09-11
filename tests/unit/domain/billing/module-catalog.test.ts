import { describe, expect, it } from "vitest";
import {
  CORE_MODULE_KEY,
  findModule,
  isCoreModule,
  isModuleKey,
  MODULE_CATALOG,
  MODULE_KEYS,
  missingDependencies,
  withDependencies,
} from "@/domain/billing/module-catalog";

describe("catálogo de módulos", () => {
  it("o Core é o primeiro e é o único obrigatório", () => {
    expect(MODULE_CATALOG[0]?.key).toBe(CORE_MODULE_KEY);
    expect(MODULE_CATALOG.filter((entry) => entry.isCore).map((entry) => entry.key)).toEqual([CORE_MODULE_KEY]);
    expect(isCoreModule(CORE_MODULE_KEY)).toBe(true);
    expect(isCoreModule("whatsapp")).toBe(false);
  });

  it("as chaves são únicas e correspondem às entradas", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
    expect(MODULE_CATALOG.map((entry) => entry.key)).toEqual([...MODULE_KEYS]);
  });

  it("todo módulo tem nome, descrição e benefício preenchidos", () => {
    for (const entry of MODULE_CATALOG) {
      expect(entry.name.length, entry.key).toBeGreaterThan(1);
      expect(entry.description.length, entry.key).toBeGreaterThan(10);
      expect(entry.benefit.length, entry.key).toBeGreaterThan(10);
      // Limite da coluna `modules.benefit` (VARCHAR 255).
      expect(entry.benefit.length, entry.key).toBeLessThanOrEqual(255);
    }
  });

  it("toda dependência declarada existe no catálogo e não é o próprio módulo", () => {
    for (const entry of MODULE_CATALOG) {
      for (const dependency of entry.dependsOn) {
        expect(isModuleKey(dependency), `${entry.key} → ${dependency}`).toBe(true);
        expect(dependency).not.toBe(entry.key);
      }
    }
  });

  it("reconhece chave conhecida e rejeita desconhecida", () => {
    expect(isModuleKey("whatsapp")).toBe(true);
    expect(isModuleKey("modulo-inventado")).toBe(false);
    expect(findModule("modulo-inventado")).toBeUndefined();
    expect(findModule("whatsapp")?.name).toBe("WhatsApp");
  });
});

describe("resolução de dependências", () => {
  it("o Core entra sempre, mesmo em seleção vazia", () => {
    expect(withDependencies([])).toEqual([CORE_MODULE_KEY]);
  });

  it("mantém a ordem do catálogo e não duplica", () => {
    expect(withDependencies(["whatsapp", "vencimentos", "whatsapp"])).toEqual([
      CORE_MODULE_KEY,
      "vencimentos",
      "whatsapp",
    ]);
  });

  it("ignora chave desconhecida em vez de quebrar", () => {
    expect(withDependencies(["modulo-inventado"])).toEqual([CORE_MODULE_KEY]);
  });

  it("nenhuma dependência falta quando a seleção já foi resolvida", () => {
    expect(missingDependencies(withDependencies([...MODULE_KEYS]))).toEqual([]);
  });

  it("hoje nenhum módulo declara dependência além do Core implícito", () => {
    // A spec (2.6) só cita "WhatsApp depende de Gestão documental", que é
    // Core. Qualquer dependência nova é decisão comercial: quando entrar no
    // catálogo, este teste falha de propósito e deve ganhar o caso concreto.
    expect(MODULE_CATALOG.filter((entry) => entry.dependsOn.length > 0)).toEqual([]);
    for (const key of MODULE_KEYS) {
      expect(missingDependencies([key]), key).toEqual([]);
    }
  });
});
