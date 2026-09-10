import { describe, expect, it } from "vitest";
import { parseEnv } from "@/infrastructure/config/env";

const development = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://veldocs:veldocs_dev_only@127.0.0.1:5440/veldocs_dev",
};

const deployed = {
  APP_URL: "https://app.veldocs.example",
  LOG_LEVEL: "warn",
  DATABASE_URL: "postgresql://app:not-a-real-secret@db.internal:5432/veldocs",
};

describe("parseEnv", () => {
  it("aceita uma configuração válida de development", () => {
    expect(parseEnv(development)).toEqual(development);
  });

  it("usa development e info como padrão para APP_ENV e LOG_LEVEL", () => {
    const env = parseEnv({ APP_URL: development.APP_URL, DATABASE_URL: development.DATABASE_URL });

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

  it("não expõe valores das variáveis na mensagem de erro", () => {
    const secret = "S3cr3t-Should-Not-Leak";

    let message = "";
    try {
      parseEnv({
        ...development,
        APP_ENV: "production",
        APP_URL: `http://user:${secret}@app.veldocs.example`,
        DATABASE_URL: `mysql://root:${secret}@db.internal/veldocs`,
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("Configuração de ambiente inválida");
    expect(message).not.toContain(secret);
  });
});
