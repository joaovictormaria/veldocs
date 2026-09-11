import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Janela fixa no PostgreSQL. O incremento é um único UPSERT atômico com o
 * relógio do banco, então requisições concorrentes (inclusive de várias
 * instâncias da aplicação) não perdem contagens.
 */
export function createPrismaRateLimiter(prisma: PrismaClient): RateLimiter {
  return {
    async consume(key, rule) {
      const windowSeconds = rule.windowMs / 1000;

      const [bucket] = await prisma.$queryRaw<Array<{ count: number; reset_at: Date }>>`
        INSERT INTO rate_limit_buckets AS bucket (key, count, reset_at)
        VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::double precision))
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN bucket.reset_at <= now() THEN 1 ELSE bucket.count + 1 END,
          reset_at = CASE
            WHEN bucket.reset_at <= now() THEN now() + make_interval(secs => ${windowSeconds}::double precision)
            ELSE bucket.reset_at
          END
        RETURNING count, reset_at
      `;

      if (!bucket) throw new Error("falha ao registrar tentativa no rate limiter");

      return {
        allowed: bucket.count <= rule.limit,
        remaining: Math.max(0, rule.limit - bucket.count),
        resetAt: bucket.reset_at,
      };
    },
  };
}
