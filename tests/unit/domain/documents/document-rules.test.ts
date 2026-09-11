import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  depthOf,
  fitsUnder,
  isDescendantOf,
  MAX_CATEGORY_DEPTH,
  pathOf,
  subtreeHeight,
  toNodeMap,
} from "@/domain/documents/category-tree";
import { calendarDateSchema, isCalendarDate, toCalendarDate, toIsoDate } from "@/domain/documents/document-dates";
import { buildSearchText, normalizeSearchText, searchTerms } from "@/domain/documents/search-text";
import { MAX_TAGS_PER_DOCUMENT, normalizeTagName, prepareTags } from "@/domain/documents/tags";

describe("texto de busca", () => {
  it("ignora acentuação, maiúsculas e espaços repetidos", () => {
    expect(normalizeSearchText("  Certidão   NEGATIVA de Débitos ")).toBe("certidao negativa de debitos");
    expect(normalizeSearchText("Alvará")).toBe(normalizeSearchText("alvara"));
    expect(normalizeSearchText("ÁÉÍÓÚ Ãõ Çç Ûü")).toBe("aeiou ao cc uu");
  });

  it("junta título, descrição e etiquetas num texto só", () => {
    expect(
      buildSearchText({ title: "Alvará de Funcionamento", description: "Prefeitura", tags: ["Fiscal", "Urgente"] }),
    ).toBe("alvara de funcionamento prefeitura fiscal urgente");
  });

  it("aceita documento sem descrição e sem etiquetas", () => {
    expect(buildSearchText({ title: "Contrato", description: null })).toBe("contrato");
  });

  it("quebra a busca em termos e limita a quantidade", () => {
    expect(searchTerms(" Certidão  Negativa ")).toEqual(["certidao", "negativa"]);
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms("a b c d e f g h")).toHaveLength(6);
  });
});

describe("etiquetas", () => {
  it("remove espaços das pontas e repetidos", () => {
    expect(normalizeTagName("  Documentos   fiscais ")).toBe("Documentos fiscais");
  });

  it("trata maiúsculas e acentos como a mesma etiqueta, mantendo a primeira grafia", () => {
    expect(prepareTags(["Fiscal", "fiscal", "FISCAL"])).toEqual([{ name: "Fiscal", key: "fiscal" }]);
    expect(prepareTags(["Órgão", "orgao"])).toEqual([{ name: "Órgão", key: "orgao" }]);
  });

  it("descarta vazias e ordena sempre igual, venha na ordem que vier", () => {
    const nomes = (values: string[]) => prepareTags(values).map((tag) => tag.name);

    expect(nomes(["  ", "", "Urgente"])).toEqual(["Urgente"]);
    expect(nomes(["Urgente", "Fiscal"])).toEqual(nomes(["Fiscal", "Urgente"]));
  });

  it("o limite por documento é conhecido pelo domínio", () => {
    expect(MAX_TAGS_PER_DOCUMENT).toBe(10);
  });
});

describe("árvore de categorias", () => {
  // raiz → filha → neta, mais uma raiz solta.
  const nodes = toNodeMap([
    { id: "raiz", parentId: null },
    { id: "filha", parentId: "raiz" },
    { id: "neta", parentId: "filha" },
    { id: "outra", parentId: null },
  ]);

  it("lista as ancestrais da mais próxima até a raiz", () => {
    expect(ancestorsOf("neta", nodes)).toEqual(["filha", "raiz"]);
    expect(ancestorsOf("raiz", nodes)).toEqual([]);
  });

  it("conta o nível a partir de 1", () => {
    expect(depthOf("raiz", nodes)).toBe(1);
    expect(depthOf("neta", nodes)).toBe(MAX_CATEGORY_DEPTH);
  });

  it("mede a altura da subárvore", () => {
    expect(subtreeHeight("raiz", nodes)).toBe(3);
    expect(subtreeHeight("filha", nodes)).toBe(2);
    expect(subtreeHeight("neta", nodes)).toBe(1);
  });

  it("reconhece descendentes, inclusive indiretas", () => {
    expect(isDescendantOf("neta", "raiz", nodes)).toBe(true);
    expect(isDescendantOf("raiz", "neta", nodes)).toBe(false);
    expect(isDescendantOf("outra", "raiz", nodes)).toBe(false);
  });

  it("categoria nova só cabe até o último nível", () => {
    expect(fitsUnder(null, null, nodes)).toBe(true);
    expect(fitsUnder("filha", null, nodes)).toBe(true);
    expect(fitsUnder("neta", null, nodes)).toBe(false);
  });

  it("mover uma categoria leva junto a subárvore dela", () => {
    // "raiz" tem 3 níveis: não cabe embaixo de ninguém.
    expect(fitsUnder("outra", "raiz", nodes)).toBe(false);
    // "neta" é folha: cabe embaixo de outra raiz.
    expect(fitsUnder("outra", "neta", nodes)).toBe(true);
    // "filha" tem 2 níveis: embaixo de uma raiz ficaria com 3.
    expect(fitsUnder("outra", "filha", nodes)).toBe(true);
  });

  it("monta o caminho da raiz até a categoria", () => {
    const names = new Map([
      ["raiz", "Pessoal"],
      ["filha", "Admissão"],
      ["neta", "Exames"],
    ]);

    expect(pathOf("neta", names, nodes)).toEqual(["Pessoal", "Admissão", "Exames"]);
    expect(pathOf("raiz", names, nodes)).toEqual(["Pessoal"]);
  });

  it("não entra em laço infinito se o banco tiver um ciclo", () => {
    const ciclo = toNodeMap([
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ]);

    expect(ancestorsOf("a", ciclo)).toEqual(["b"]);
  });
});

describe("datas de emissão e validade", () => {
  it("aceita data de calendário no formato AAAA-MM-DD", () => {
    expect(isCalendarDate("2026-09-11")).toBe(true);
    expect(calendarDateSchema.safeParse("2026-09-11").success).toBe(true);
  });

  it("recusa data inexistente, formato errado e texto", () => {
    for (const value of ["2026-02-31", "2026-13-01", "11/09/2026", "2026-9-1", "ontem", ""]) {
      expect(isCalendarDate(value), value).toBe(false);
    }
  });

  it("vai e volta pela meia-noite UTC, sem deslocar o dia", () => {
    expect(toCalendarDate("2026-09-11").toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(toIsoDate(toCalendarDate("2026-01-01"))).toBe("2026-01-01");
  });
});
