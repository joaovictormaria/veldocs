/**
 * Porta de rate limiting. Implementação prevista para a FASE 2 (Redis planejado).
 * A chave deve combinar o escopo e o sujeito (ex.: "login:ip:203.0.113.10").
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

export interface RateLimiter {
  consume(key: string, cost?: number): Promise<RateLimitResult>;
}
