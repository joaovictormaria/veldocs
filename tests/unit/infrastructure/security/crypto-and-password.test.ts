import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createArgon2PasswordHasher } from "@/infrastructure/security/argon2-password-hasher";
import {
  createFieldEncryptor,
  createLookupHasher,
  generateToken,
  sha256Hex,
} from "@/infrastructure/security/crypto";

const key = randomBytes(32);

describe("tokens e hash", () => {
  it("gera tokens de 256 bits distintos em base64url", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("calcula SHA-256 em hexadecimal", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("hash de busca (HMAC)", () => {
  it("é determinístico para a mesma chave e diferente entre chaves", () => {
    const lookup = createLookupHasher(key);
    expect(lookup("52998224725")).toBe(lookup("52998224725"));
    expect(lookup("52998224725")).toMatch(/^[0-9a-f]{64}$/);
    expect(createLookupHasher(randomBytes(32))("52998224725")).not.toBe(lookup("52998224725"));
  });

  it("recusa chave curta", () => {
    expect(() => createLookupHasher(randomBytes(16))).toThrow();
  });
});

describe("criptografia de campo (AES-256-GCM)", () => {
  const encryptor = createFieldEncryptor(key, "users.cpf");

  it("cifra e decifra, com saída diferente a cada vez e sem o valor em claro", () => {
    const first = encryptor.encrypt("52998224725");
    const second = encryptor.encrypt("52998224725");

    expect(first).not.toBe(second);
    expect(first).not.toContain("52998224725");
    expect(first.startsWith("v1.")).toBe(true);
    expect(encryptor.decrypt(first)).toBe("52998224725");
  });

  it("detecta adulteração do conteúdo", () => {
    const [version, iv, tag, ciphertext] = encryptor.encrypt("52998224725").split(".");
    const flipped = Buffer.from(ciphertext as string, "base64url");
    flipped[0] = (flipped[0] as number) ^ 1;

    expect(() => encryptor.decrypt([version, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("não decifra valor cifrado para outro campo (contexto autenticado)", () => {
    const payload = createFieldEncryptor(key, "users.other").encrypt("52998224725");
    expect(() => encryptor.decrypt(payload)).toThrow();
  });

  it("não decifra com outra chave e recusa formato inválido", () => {
    const payload = encryptor.encrypt("52998224725");
    expect(() => createFieldEncryptor(randomBytes(32), "users.cpf").decrypt(payload)).toThrow();
    expect(() => encryptor.decrypt("v2.a.b.c")).toThrow();
    expect(() => encryptor.decrypt("texto-qualquer")).toThrow();
  });

  it("exige chave de exatamente 32 bytes", () => {
    expect(() => createFieldEncryptor(randomBytes(31), "users.cpf")).toThrow();
  });
});

describe("hash de senha (Argon2id)", () => {
  const hasher = createArgon2PasswordHasher();

  it("usa Argon2id com os parâmetros do OWASP e verifica a senha", async () => {
    const hashed = await hasher.hash("frase longa e secreta");

    expect(hashed.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    await expect(hasher.verify(hashed, "frase longa e secreta")).resolves.toBe(true);
    await expect(hasher.verify(hashed, "frase longa e errada")).resolves.toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt)", async () => {
    expect(await hasher.hash("mesma senha longa")).not.toBe(await hasher.hash("mesma senha longa"));
  });

  it("responde false para hash malformado em vez de lançar", async () => {
    await expect(hasher.verify("não-é-um-hash", "qualquer senha")).resolves.toBe(false);
  });
});
