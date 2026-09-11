import { describe, expect, it } from "vitest";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import { enforceRequestRateLimit, READ_RATE_LIMIT } from "@/infrastructure/http/request-rate-limit";
import { createJsonLogger } from "@/infrastructure/observability/logger";

const silentLogger = createJsonLogger({ level: "fatal", write: () => undefined });

const request = (ip?: string) =>
  new Request("https://app.veldocs.example/api/company", {
    headers: ip ? { "x-forwarded-for": ip, "x-request-id": "req-1" } : { "x-request-id": "req-1" },
  });

function limiter(allowed: boolean) {
  const keys: string[] = [];
  const rateLimiter: RateLimiter = {
    async consume(key) {
      keys.push(key);
      return { allowed, remaining: allowed ? 100 : 0, resetAt: new Date(Date.now() + 45_000) };
    },
  };
  return { rateLimiter, keys };
}

describe("limite das rotas de negócio", () => {
  it("permite seguir quando está dentro do limite, usando o IP como chave", async () => {
    const { rateLimiter, keys } = limiter(true);

    await expect(enforceRequestRateLimit(request("203.0.113.9"), rateLimiter)).resolves.toBeNull();
    expect(keys).toEqual(["api:read:ip:203.0.113.9"]);
  });

  it("agrupa requisições sem IP conhecido", async () => {
    const { rateLimiter, keys } = limiter(true);

    await enforceRequestRateLimit(request(), rateLimiter);

    expect(keys).toEqual(["api:read:ip:unknown"]);
  });

  it("responde 429 com Retry-After quando o limite estoura", async () => {
    const { rateLimiter } = limiter(false);

    const response = await enforceRequestRateLimit(request("203.0.113.9"), rateLimiter, { logger: silentLogger });

    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(await response?.json()).toMatchObject({ error: "rate_limited" });
  });

  it("usa 120 requisições por minuto como limite padrão", () => {
    expect(READ_RATE_LIMIT).toEqual({ limit: 120, windowMs: 60_000 });
  });
});
