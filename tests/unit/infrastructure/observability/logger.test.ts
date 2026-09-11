import { describe, expect, it } from "vitest";
import { createJsonLogger, REDACTED, redactFields, requestId } from "@/infrastructure/observability/logger";

function collect(level: Parameters<typeof createJsonLogger>[0]["level"] = "info") {
  const lines: string[] = [];
  const logger = createJsonLogger({
    level,
    write: (line) => lines.push(line),
    now: () => new Date("2026-09-11T03:00:00.000Z"),
  });
  return { logger, lines, parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe("log estruturado", () => {
  it("escreve JSON de uma linha com nível, horário e campos", () => {
    const { logger, parsed } = collect();

    logger.info("authorization_denied", { reason: "forbidden", requestId: "req-1" });

    expect(parsed()).toEqual([
      {
        level: "info",
        time: "2026-09-11T03:00:00.000Z",
        message: "authorization_denied",
        reason: "forbidden",
        requestId: "req-1",
      },
    ]);
  });

  it("respeita o nível configurado", () => {
    const { logger, lines } = collect("warn");

    logger.debug("ignorado");
    logger.info("ignorado");
    logger.warn("registrado");
    logger.error("registrado");

    expect(lines).toHaveLength(2);
  });

  it("omite campos indefinidos", () => {
    const { logger, parsed } = collect();

    logger.info("evento", { presente: 1, ausente: undefined });

    expect(parsed()[0]).toEqual({
      level: "info",
      time: "2026-09-11T03:00:00.000Z",
      message: "evento",
      presente: 1,
    });
  });

  it.each(["password", "senha", "token", "secret", "segredo", "cpf", "authorization", "cookie", "code"])(
    "redige o campo %s",
    (field) => {
      expect(redactFields({ [field]: "valor-sensível" })).toEqual({ [field]: REDACTED });
    },
  );

  it("nunca escreve valores sensíveis no log", () => {
    const { logger, lines } = collect();

    logger.error("auth_failed", { cpf: "52998224725", password: "senha secreta", userId: "user-1" });

    expect(lines[0]).not.toContain("52998224725");
    expect(lines[0]).not.toContain("senha secreta");
    expect(lines[0]).toContain("user-1");
  });
});

describe("id de requisição", () => {
  it("usa o header propagado pelo proxy", () => {
    const withId = new Request("https://app.veldocs.example/api/company", { headers: { "x-request-id": "req-42" } });

    expect(requestId(withId)).toBe("req-42");
    expect(requestId(new Request("https://app.veldocs.example/api/company"))).toBeUndefined();
  });
});
