import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** Erros com código estável e sem detalhes internos. */
export function errorResponse(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextResponse {
  return jsonResponse({ error, ...extra }, status, headers);
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
