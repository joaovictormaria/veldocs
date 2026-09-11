import { describe, expect, it } from "vitest";
import { cnpjSchema, formatCnpj, isValidCnpj, normalizeCnpj } from "@/domain/company/cnpj";

describe("CNPJ", () => {
  it.each(["12345678000195", "11222333000181", "98765432000198", "55443322000105"])(
    "aceita %s (dígitos verificadores corretos)",
    (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true);
    },
  );

  it("aceita a forma com máscara e devolve somente dígitos", () => {
    expect(cnpjSchema.parse("12.345.678/0001-95")).toBe("12345678000195");
    expect(cnpjSchema.parse(" 12345678000195 ")).toBe("12345678000195");
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCnpj("12345678000196")).toBe(false);
    expect(isValidCnpj("11222333000182")).toBe(false);
  });

  it("recusa sequências repetidas, que passariam no cálculo", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("recusa tamanho errado ou texto", () => {
    for (const value of ["", "123", "1234567800019", "123456780001950", "abcdefghijklmn"]) {
      expect(isValidCnpj(value)).toBe(false);
      expect(cnpjSchema.safeParse(value).success).toBe(false);
    }
  });

  it("não deixa a limpeza de caracteres transformar lixo em CNPJ válido", () => {
    // Sem a validação de formato, remover os símbolos daria um número válido.
    expect(cnpjSchema.safeParse("12a34b56c78d00/01-95").success).toBe(false);
    expect(normalizeCnpj("12a34b56c78d000195")).toBe("12345678000195");
  });

  it("formata para exibição", () => {
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });
});
