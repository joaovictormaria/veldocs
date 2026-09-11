import { describe, expect, it } from "vitest";
import { cpfSchema, isValidCpf, normalizeCpf } from "@/domain/identity/cpf";
import { emailSchema } from "@/domain/identity/email";
import { parseLoginIdentifier } from "@/domain/identity/login-identifier";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from "@/domain/identity/password-policy";

describe("CPF", () => {
  it.each(["529.982.247-25", "52998224725", "111.444.777-35", " 111.444.777-35 "])("aceita %j", (value) => {
    expect(cpfSchema.parse(value)).toBe(normalizeCpf(value));
  });

  it.each([
    "529.982.247-24",
    "11111111111",
    "000.000.000-00",
    "1234567890",
    "123456789012",
    "529982247-2a",
    "52998224725; drop",
    "",
  ])("rejeita %j", (value) => {
    expect(cpfSchema.safeParse(value).success).toBe(false);
  });

  it("valida dígitos verificadores independentemente da máscara", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("111.444.777-36")).toBe(false);
  });
});

describe("e-mail", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(emailSchema.parse("  Maria.Silva@Example.COM ")).toBe("maria.silva@example.com");
  });

  it.each(["maria", "maria@", "@example.com", `${"a".repeat(320)}@example.com`])("rejeita %j", (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });
});

describe("política de senha", () => {
  it("aceita senha longa sem exigir composição", () => {
    expect(passwordSchema.safeParse("frase longa sem simbolos").success).toBe(true);
  });

  it("não apara espaços da senha", () => {
    expect(passwordSchema.parse("  senha com espaços  ")).toBe("  senha com espaços  ");
  });

  it("exige o tamanho mínimo", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
  });

  it("limita o tamanho máximo contando caracteres Unicode", () => {
    expect(passwordSchema.safeParse("🔐".repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("🔐".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe("identificador de login", () => {
  it("reconhece e-mail", () => {
    expect(parseLoginIdentifier(" Maria@Example.com")).toEqual({ kind: "email", email: "maria@example.com" });
  });

  it("reconhece CPF com ou sem máscara", () => {
    expect(parseLoginIdentifier("529.982.247-25")).toEqual({ kind: "cpf", cpf: "52998224725" });
    expect(parseLoginIdentifier("52998224725")).toEqual({ kind: "cpf", cpf: "52998224725" });
  });

  it.each(["", "maria", "529.982.247-24", "maria@"])("retorna null para %j", (value) => {
    expect(parseLoginIdentifier(value)).toBeNull();
  });
});
