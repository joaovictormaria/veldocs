import { type NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/infrastructure/config/env";
import { buildSecurityHeaders, generateNonce } from "@/infrastructure/http/security-headers";

/**
 * Aplica os headers de segurança e propaga um id de requisição.
 *
 * Checagens de autenticação/autorização NÃO ficam aqui: cada rota decide por
 * conta própria (ver `authorizeRequest`), como recomenda a documentação do
 * Next.js.
 */
export default function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const headers = buildSecurityHeaders({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    isHttps: getEnv().APP_URL.startsWith("https://"),
  });
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("x-request-id", requestId);
  // O Next.js lê o nonce daqui para assinar os próprios scripts.
  forwardedHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"] as string);

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  // Arquivos estáticos e otimização de imagens não precisam de nonce por requisição.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
