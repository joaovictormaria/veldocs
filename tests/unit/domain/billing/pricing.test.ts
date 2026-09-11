import { describe, expect, it } from "vitest";
import { quoteMonthly } from "@/domain/billing/pricing";

const prices = new Map<string, number>([
  ["core", 4990],
  ["vencimentos", 1990],
  ["whatsapp", 5990],
]);

describe("orçamento mensal", () => {
  it("o Core entra sempre, mesmo sem nada escolhido", () => {
    expect(quoteMonthly([], prices)).toEqual({ modules: ["core"], totalCents: 4990, unpriced: [], unknown: [] });
  });

  it("soma na ordem do catálogo e não cobra duas vezes o mesmo módulo", () => {
    expect(quoteMonthly(["whatsapp", "vencimentos", "whatsapp", "core"], prices)).toEqual({
      modules: ["core", "vencimentos", "whatsapp"],
      totalCents: 12970,
      unpriced: [],
      unknown: [],
    });
  });

  it("módulo sem preço vigente fica explícito em vez de valer zero", () => {
    const quote = quoteMonthly(["contratos"], prices);

    expect(quote.totalCents).toBe(4990);
    expect(quote.unpriced).toEqual(["contratos"]);
  });

  it("chave fora do catálogo é apontada uma vez e não entra no total", () => {
    const quote = quoteMonthly(["modulo-inventado", "modulo-inventado"], prices);

    expect(quote.unknown).toEqual(["modulo-inventado"]);
    expect(quote.modules).toEqual(["core"]);
    expect(quote.totalCents).toBe(4990);
  });

  it("recusa preço que não seja centavos inteiros não negativos", () => {
    expect(() => quoteMonthly([], new Map([["core", 49.9]]))).toThrow(/preço inválido/);
    expect(() => quoteMonthly([], new Map([["core", -1]]))).toThrow(/preço inválido/);
  });
});
