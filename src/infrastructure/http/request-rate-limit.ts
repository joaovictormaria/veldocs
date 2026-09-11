import "server-only";
import type { NextResponse } from "next/server";
import type { RateLimiter, RateLimitRule } from "@/application/ports/rate-limiter";
import { getLogger, type Logger, requestId } from "@/infrastructure/observability/logger";
import { clientIpAddress } from "./request-security";
import { errorResponse } from "./responses";

/** Limite geral das rotas de negócio, por IP. */
export const READ_RATE_LIMIT: RateLimitRule = { limit: 120, windowMs: 60_000 };

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return errorResponse(
    429,
    "rate_limited",
    { message: "Muitas requisições. Tente novamente em instantes." },
    { "Retry-After": String(retryAfterSeconds) },
  );
}

/**
 * Aplica o limite por IP antes de qualquer consulta.
 * Devolve a resposta 429 quando o limite estourou, ou `null` para seguir.
 */
export async function enforceRequestRateLimit(
  request: Request,
  rateLimiter: RateLimiter,
  options: { readonly scope?: string; readonly rule?: RateLimitRule; readonly logger?: Logger } = {},
): Promise<NextResponse | null> {
  const scope = options.scope ?? "api:read";
  const ipAddress = clientIpAddress(request.headers);
  const result = await rateLimiter.consume(`${scope}:ip:${ipAddress ?? "unknown"}`, options.rule ?? READ_RATE_LIMIT);
  if (result.allowed) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  (options.logger ?? getLogger()).warn("request_rate_limited", {
    scope,
    requestId: requestId(request),
    path: new URL(request.url).pathname,
    retryAfterSeconds,
  });

  return rateLimitedResponse(retryAfterSeconds);
}
