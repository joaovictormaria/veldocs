import { describe, expect, it } from "vitest";
import { findKit, isKitKey, KIT_CATALOG, KIT_KEYS } from "@/domain/billing/kit-catalog";
import { CORE_MODULE_KEY, isModuleKey, MODULE_KEYS } from "@/domain/billing/module-catalog";

describe("catálogo de kits", () => {
  it("tem os 6 kits da tabela do usuário, com chaves únicas", () => {
    expect(KIT_CATALOG.map((kit) => kit.name)).toEqual([
      "Essencial",
      "Gestão",
      "Inteligência",
      "Comunicação",
      "Controle Avançado",
      "Complete",
    ]);
    expect(KIT_CATALOG.map((kit) => kit.key)).toEqual([...KIT_KEYS]);
    expect(new Set(KIT_KEYS).size).toBe(KIT_KEYS.length);
  });

  it("todo kit inclui o Core e só módulos do catálogo, sem repetir, na ordem do catálogo", () => {
    for (const kit of KIT_CATALOG) {
      expect(kit.modules[0], kit.key).toBe(CORE_MODULE_KEY);
      expect(kit.modules.every((key) => isModuleKey(key)), kit.key).toBe(true);
      expect(new Set(kit.modules).size, kit.key).toBe(kit.modules.length);
      expect([...kit.modules], kit.key).toEqual(MODULE_KEYS.filter((key) => kit.modules.includes(key)));
    }
  });

  it("o Complete traz todos os módulos", () => {
    expect([...(findKit("complete")?.modules ?? [])]).toEqual([...MODULE_KEYS]);
  });

  it("o Essencial é Core + Controle de vencimentos, onde ficam os alertas", () => {
    expect(findKit("essencial")?.modules).toEqual([CORE_MODULE_KEY, "vencimentos"]);
  });

  it("reconhece kit existente e rejeita inventado", () => {
    expect(isKitKey("gestao")).toBe(true);
    expect(isKitKey("kit-inventado")).toBe(false);
    expect(findKit("kit-inventado")).toBeUndefined();
  });
});
