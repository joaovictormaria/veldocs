import { describe, expect, it } from "vitest";
import type { HealthProbe } from "@/application/ports/health-probe";
import { checkHealth } from "@/application/system/check-health";

const up = (name: string): HealthProbe => ({ name, check: async () => undefined });

const failing = (name: string, message = "connection refused"): HealthProbe => ({
  name,
  check: async () => {
    throw new Error(message);
  },
});

const hanging = (name: string): HealthProbe => ({ name, check: () => new Promise(() => undefined) });

describe("checkHealth", () => {
  it("retorna ok quando todos os componentes estão disponíveis", async () => {
    await expect(checkHealth([up("database"), up("cache")])).resolves.toEqual({
      status: "ok",
      checks: { database: "up", cache: "up" },
    });
  });

  it("retorna degraded quando algum componente falha", async () => {
    await expect(checkHealth([up("database"), failing("cache")])).resolves.toEqual({
      status: "degraded",
      checks: { database: "up", cache: "down" },
    });
  });

  it("marca como down um componente que excede o timeout", async () => {
    await expect(checkHealth([hanging("database")], { timeoutMs: 20 })).resolves.toEqual({
      status: "degraded",
      checks: { database: "down" },
    });
  });

  it("não expõe mensagens de erro internas no relatório", async () => {
    const report = await checkHealth([failing("database", "password authentication failed for user x")]);

    expect(JSON.stringify(report)).not.toContain("password");
  });
});
