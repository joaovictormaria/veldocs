import { describe, expect, it } from "vitest";
import {
  documentsQuery,
  EMPTY_FILTERS,
  formatTagsInput,
  pageSummary,
  parseTagsInput,
} from "@/presentation/documents";
import { formatCalendarDate } from "@/presentation/format";

describe("etiquetas no formulário", () => {
  it("separa por vírgula, tira espaços e descarta vazias", () => {
    expect(parseTagsInput(" Fiscal , Urgente ,, ")).toEqual(["Fiscal", "Urgente"]);
    expect(parseTagsInput("   ")).toEqual([]);
  });

  it("volta para o campo como a pessoa espera ler", () => {
    expect(formatTagsInput(["Fiscal", "Urgente"])).toBe("Fiscal, Urgente");
    expect(formatTagsInput([])).toBe("");
  });
});

describe("consulta da listagem", () => {
  it("não manda parâmetro vazio nem o que já é padrão", () => {
    expect(documentsQuery(EMPTY_FILTERS)).toBe("");
  });

  it("manda só o que a pessoa escolheu", () => {
    const query = documentsQuery({
      ...EMPTY_FILTERS,
      q: "  certidão  ",
      categoryId: "cat-1",
      tag: "Fiscal",
      sort: "title",
      page: 3,
    });

    expect(new URLSearchParams(query)).toEqual(
      new URLSearchParams({ q: "certidão", categoryId: "cat-1", tag: "Fiscal", sort: "title", page: "3" }),
    );
  });
});

describe("resumo da página", () => {
  it("conta o intervalo mostrado", () => {
    expect(pageSummary(37, 1, 20)).toBe("1-20 de 37");
    expect(pageSummary(37, 2, 20)).toBe("21-37 de 37");
    expect(pageSummary(5, 1, 20)).toBe("1-5 de 5");
  });

  it("avisa quando não há nada", () => {
    expect(pageSummary(0, 1, 20)).toBe("Nenhum documento encontrado");
  });
});

describe("datas de calendário na tela", () => {
  it("mostra o mesmo dia que foi digitado, sem escorregar por fuso", () => {
    expect(formatCalendarDate("2026-02-01")).toBe("01/02/2026");
    // Meia-noite UTC em Brasília seria o dia anterior: por isso a data é lida em UTC.
    expect(formatCalendarDate("2026-01-01")).toBe("01/01/2026");
  });
});
