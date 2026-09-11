import { isIP } from "node:net";
import type { RequestContext } from "@/application/auth/shared";

/**
 * IP do cliente atrás do proxy do Railway: usa o ÚLTIMO valor de
 * X-Forwarded-For, que é o acrescentado pela borda confiável. O primeiro valor
 * pode ser forjado pelo próprio cliente.
 */
export function clientIpAddress(headers: Headers): string | null {
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  const candidate = forwarded ?? headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function requestContext(request: Request): RequestContext {
  return {
    ipAddress: clientIpAddress(request.headers),
    userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

/**
 * Proteção CSRF para rotas que alteram estado: o navegador precisa declarar a
 * mesma origem da aplicação (Origin) ou, na ausência dele, Sec-Fetch-Site.
 * Complementa o cookie SameSite=Lax.
 */
export function isSameOriginRequest(request: Request, appUrl: string): boolean {
  const expected = new URL(appUrl).origin;
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === expected;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export const MAX_JSON_BODY_BYTES = 16 * 1024;

export type JsonBodyResult =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly status: 400 | 413 | 415; readonly error: string };

/** Lê JSON com limite de tamanho aplicado durante a leitura do corpo. */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return { ok: false, status: 413, error: "payload_too_large" };

  if (!request.body) return { ok: false, status: 400, error: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "payload_too_large" };
    }
    chunks.push(value);
  }

  try {
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

export interface SessionCookieSettings {
  readonly name: string;
  readonly options: {
    readonly httpOnly: true;
    readonly secure: boolean;
    readonly sameSite: "lax";
    readonly path: "/";
  };
}

/**
 * Em HTTPS usa o prefixo `__Host-` (exige Secure, Path=/ e nenhum Domain),
 * impedindo que subdomínios sobrescrevam o cookie.
 */
export function sessionCookieSettings(appUrl: string): SessionCookieSettings {
  const secure = new URL(appUrl).protocol === "https:";
  return {
    name: secure ? "__Host-veldocs_session" : "veldocs_session",
    options: { httpOnly: true, secure, sameSite: "lax", path: "/" },
  };
}
