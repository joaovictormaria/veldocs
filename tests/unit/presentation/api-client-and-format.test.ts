import { describe, expect, it } from "vitest";
import { errorMessage, fieldErrors, safeNextPath } from "@/presentation/api-client";
import { formatBRL, formatDate, pluralizeDays } from "@/presentation/format";

/**
 * O Intl separa "R$" do valor com espaço inseparável (U+00A0). O caractere é
 * montado pelo código, e não digitado, para não ficar invisível no arquivo.
 */
const NON_BREAKING_SPACE = String.fromCharCode(0xa0);
const plain = (text: string) => text.split(NON_BREAKING_SPACE).join(" ");

describe("destino depois do login", () => {
  it.each(["/builder", "/convite/abc", "/entrar?next=/x"])("aceita caminho interno %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "builder"])(
    "recusa %j e usa o padrão",
    (path) => {
      expect(safeNextPath(path)).toBe("/inicio");
    },
  );
});

describe("mensagens da API", () => {
  it("prioriza problemas de validação, depois a mensagem, depois o padrão", () => {
    expect(errorMessage({ issues: [{ field: "a", message: "um" }, { field: "b", message: "dois" }] }, "padrão")).toBe(
      "um; dois",
    );
    expect(errorMessage({ message: "da API" }, "padrão")).toBe("da API");
    expect(errorMessage({}, "padrão")).toBe("padrão");
    expect(errorMessage(null, "padrão")).toBe("padrão");
  });

  it("agrupa os erros por campo", () => {
    expect(fieldErrors({ issues: [{ field: "email", message: "e-mail inválido" }] })).toEqual({ email: "e-mail inválido" });
    expect(fieldErrors(undefined)).toEqual({});
  });
});

describe("formatação", () => {
  it("dinheiro em reais a partir de centavos", () => {
    expect(formatBRL(16980)).toContain(NON_BREAKING_SPACE);
    expect(plain(formatBRL(16980))).toBe("R$ 169,80");
    expect(plain(formatBRL(63830))).toBe("R$ 638,30");
    expect(plain(formatBRL(0))).toBe("R$ 0,00");
  });

  it("data no fuso de Brasília", () => {
    // 02:00 UTC do dia 18 ainda é dia 17 em Brasília.
    expect(formatDate("2026-09-18T02:00:00.000Z")).toBe("17 de setembro de 2026");
  });

  it("dias restantes no singular e no plural", () => {
    expect(pluralizeDays(1)).toBe("1 dia restante");
    expect(pluralizeDays(14)).toBe("14 dias restantes");
    expect(pluralizeDays(0)).toBe("0 dias restantes");
  });
});
