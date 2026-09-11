import { describe, expect, it } from "vitest";
import { type KitOffer, quoteKit, quoteMonthly, suggestKit } from "@/domain/billing/pricing";

const prices = new Map<string, number>([
  ["core", 4990],
  ["vencimentos", 1990],
  ["contratos", 3990],
  ["solicitacoes", 2990],
  ["whatsapp", 5990],
]);

const comunica: KitOffer = { key: "comunica", modules: ["core", "solicitacoes", "whatsapp"], priceCents: 9990 };
const basico: KitOffer = { key: "basico", modules: ["core", "vencimentos"], priceCents: 5990 };

describe("orçamento mensal avulso", () => {
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
    const quote = quoteMonthly(["aprovacoes"], prices);

    expect(quote.totalCents).toBe(4990);
    expect(quote.unpriced).toEqual(["aprovacoes"]);
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

describe("kit + módulos avulsos", () => {
  it("cobra o kit e, à parte, só o que ficou fora dele", () => {
    expect(quoteKit(comunica, ["whatsapp", "contratos"], prices)).toEqual({
      kitKey: "comunica",
      modules: ["core", "contratos", "solicitacoes", "whatsapp"],
      kitCents: 9990,
      extras: ["contratos"],
      extrasCents: 3990,
      totalCents: 13980,
      unpriced: [],
      unknown: [],
    });
  });

  it("kit sozinho custa o preço do kit", () => {
    expect(quoteKit(basico, [], prices).totalCents).toBe(5990);
  });

  it("extra sem preço fica explícito e extra inexistente é apontado", () => {
    const quote = quoteKit(basico, ["aprovacoes", "modulo-inventado"], prices);

    expect(quote.unpriced).toEqual(["aprovacoes"]);
    expect(quote.unknown).toEqual(["modulo-inventado"]);
    expect(quote.totalCents).toBe(5990);
  });

  it("recusa preço de kit inválido", () => {
    expect(() => quoteKit({ ...basico, priceCents: -5 }, [], prices)).toThrow(/preço inválido/);
  });
});

describe("sugestão de kit", () => {
  it("sugere o kit quando a mesma seleção sai mais barata com ele", () => {
    // Avulso: 49,90 + 29,90 + 59,90 = 139,70. Com o kit: 99,90.
    expect(suggestKit(["solicitacoes", "whatsapp"], prices, [comunica, basico])).toEqual({
      kitKey: "comunica",
      totalCents: 9990,
      savingsCents: 3980,
    });
  });

  it("sugere kit que traz módulos a mais, desde que fique mais barato", () => {
    // Avulso: 49,90 + 59,90 = 109,80. O kit (com Solicitações de brinde): 99,90.
    expect(suggestKit(["whatsapp"], prices, [comunica])).toEqual({
      kitKey: "comunica",
      totalCents: 9990,
      savingsCents: 990,
    });
  });

  it("não sugere kit mais caro que a compra avulsa", () => {
    const caro: KitOffer = { key: "caro", modules: ["core", "vencimentos"], priceCents: 6990 };
    // Avulso: 49,90 + 19,90 = 69,80 < 69,90.
    expect(suggestKit(["vencimentos"], prices, [caro])).toBeNull();
  });

  it("escolhe o kit com a maior economia", () => {
    const outro: KitOffer = { key: "outro", modules: ["core", "solicitacoes", "whatsapp"], priceCents: 8990 };
    expect(suggestKit(["solicitacoes", "whatsapp"], prices, [comunica, outro])?.kitKey).toBe("outro");
  });

  it("não sugere quando falta preço para comparar", () => {
    expect(suggestKit(["aprovacoes", "whatsapp"], prices, [comunica])).toBeNull();
  });
});
