import { describe, expect, it } from "vitest";
import { parseEnv } from "@/infrastructure/config/env";

// Chaves de TESTE (não são secrets): base64 de 32 bytes ASCII conhecidos.
const TEST_ENCRYPTION_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
const TEST_HMAC_KEY = Buffer.from("fedcba9876543210fedcba9876543210").toString("base64");

const development = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://veldocs:veldocs_dev_only@127.0.0.1:5440/veldocs_dev",
  APP_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  APP_HMAC_KEY: TEST_HMAC_KEY,
};

const deployed = {
  APP_URL: "https://app.veldocs.example",
  LOG_LEVEL: "warn",
  DATABASE_URL: "postgresql://app:not-a-real-secret@db.internal:5432/veldocs",
  APP_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  APP_HMAC_KEY: TEST_HMAC_KEY,
};

describe("parseEnv", () => {
  it("aceita uma configuração válida de development", () => {
    expect(parseEnv(development)).toEqual(development);
  });

  it("usa development e info como padrão para APP_ENV e LOG_LEVEL", () => {
    const env = parseEnv({ ...development, APP_ENV: undefined, LOG_LEVEL: undefined });

    expect(env.APP_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it.each(["staging", "production"] as const)("aceita configuração válida de %s", (appEnv) => {
    expect(parseEnv({ ...deployed, APP_ENV: appEnv }).APP_ENV).toBe(appEnv);
  });

  it.each(["test", "prod", "local", ""])("rejeita APP_ENV desconhecido: %j", (appEnv) => {
    expect(() => parseEnv({ ...development, APP_ENV: appEnv })).toThrow(/APP_ENV/);
  });

  it("exige DATABASE_URL", () => {
    expect(() => parseEnv({ ...development, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("rejeita DATABASE_URL que não seja PostgreSQL", () => {
    expect(() =>
      parseEnv({ ...development, DATABASE_URL: "mysql://root:root@localhost:3306/veldocs" }),
    ).toThrow(/DATABASE_URL: deve ser uma URL PostgreSQL válida/);
  });

  it.each(["staging", "production"] as const)("exige https em %s", (appEnv) => {
    expect(() =>
      parseEnv({ ...deployed, APP_ENV: appEnv, APP_URL: "http://app.veldocs.example" }),
    ).toThrow(/APP_URL: deve usar https/);
  });

  it.each(["staging", "production"] as const)(
    "bloqueia credenciais locais de desenvolvimento em %s",
    (appEnv) => {
      expect(() =>
        parseEnv({ ...deployed, APP_ENV: appEnv, DATABASE_URL: development.DATABASE_URL }),
      ).toThrow(/DATABASE_URL: credenciais locais de desenvolvimento/);
    },
  );

  it.each(["APP_ENCRYPTION_KEY", "APP_HMAC_KEY"] as const)("exige %s", (name) => {
    expect(() => parseEnv({ ...development, [name]: undefined })).toThrow(new RegExp(name));
  });

  it("exige chave de criptografia com exatamente 32 bytes", () => {
    const short = Buffer.alloc(31, 1).toString("base64");
    const long = Buffer.alloc(33, 1).toString("base64");

    expect(() => parseEnv({ ...development, APP_ENCRYPTION_KEY: short })).toThrow(/APP_ENCRYPTION_KEY: deve ter exatamente 32 bytes/);
    expect(() => parseEnv({ ...development, APP_ENCRYPTION_KEY: long })).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("exige chave de HMAC com pelo menos 32 bytes e em base64", () => {
    expect(parseEnv({ ...development, APP_HMAC_KEY: Buffer.alloc(64, 7).toString("base64") }).APP_HMAC_KEY).toBeTruthy();
    expect(() => parseEnv({ ...development, APP_HMAC_KEY: Buffer.alloc(16, 7).toString("base64") })).toThrow(/APP_HMAC_KEY: deve ter pelo menos 32 bytes/);
    expect(() => parseEnv({ ...development, APP_HMAC_KEY: "não é base64!" })).toThrow(/APP_HMAC_KEY: deve estar em base64/);
  });

  it("não expõe valores das variáveis na mensagem de erro", () => {
    const secret = "S3cr3t-Should-Not-Leak";

    let message = "";
    try {
      parseEnv({
        ...development,
        APP_ENV: "production",
        APP_URL: `http://user:${secret}@app.veldocs.example`,
        DATABASE_URL: `mysql://root:${secret}@db.internal/veldocs`,
        APP_ENCRYPTION_KEY: Buffer.from(`${secret}${secret}`).toString("base64"),
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("Configuração de ambiente inválida");
    expect(message).not.toContain(secret);
    expect(message).not.toContain(Buffer.from(`${secret}${secret}`).toString("base64"));
  });
});
