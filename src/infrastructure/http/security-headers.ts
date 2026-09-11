/**
 * Headers de segurança aplicados a toda resposta (ver src/proxy.ts).
 *
 * A CSP usa nonce por requisição: o Next.js assina seus próprios scripts com
 * o nonce recebido no header da requisição, dispensando `unsafe-inline`.
 */
export interface SecurityHeaderOptions {
  readonly nonce: string;
  /** Em desenvolvimento o React usa `eval` para melhorar as mensagens de erro. */
  readonly isDevelopment: boolean;
  /** HSTS só faz sentido quando a aplicação é servida por HTTPS. */
  readonly isHttps: boolean;
}

export function buildContentSecurityPolicy({ nonce, isDevelopment }: SecurityHeaderOptions): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...(options.isHttps ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/** Nonce aleatório e imprevisível por requisição. */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
