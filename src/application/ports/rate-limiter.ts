/**
 * Porta de rate limiting (janela fixa). Implementação atual: PostgreSQL
 * (`rate_limit_buckets`); substituível por Redis sem mudar os casos de uso.
 * A chave combina escopo e sujeito e nunca contém dado pessoal em claro
 * (ex.: "auth:login:ip:203.0.113.10", "auth:login:account:<hmac>").
 */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
}

export interface RateLimiter {
  /** Conta uma tentativa e informa se ela ainda está dentro do limite. */
  consume(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}
