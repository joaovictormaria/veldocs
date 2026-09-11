import { describe, expect, it } from "vitest";
import {
  clientIpAddress,
  isSameOriginRequest,
  MAX_JSON_BODY_BYTES,
  readJsonBody,
  sessionCookieSettings,
} from "@/infrastructure/http/request-security";

const APP_URL = "https://app.veldocs.example";

const jsonRequest = (body: string, headers: Record<string, string> = {}) =>
  new Request(`${APP_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

describe("clientIpAddress", () => {
  it("usa o último valor de X-Forwarded-For (acrescentado pelo proxy confiável)", () => {
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
    expect(clientIpAddress(headers)).toBe("203.0.113.7");
  });

  it("aceita IPv6 e recorre a X-Real-IP", () => {
    expect(clientIpAddress(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIpAddress(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("descarta valores que não são IP", () => {
    expect(clientIpAddress(new Headers({ "x-forwarded-for": "evil'; DROP TABLE" }))).toBeNull();
    expect(clientIpAddress(new Headers())).toBeNull();
  });
});

describe("isSameOriginRequest", () => {
  it("aceita Origin igual ao da aplicação", () => {
    expect(isSameOriginRequest(jsonRequest("{}", { origin: APP_URL }), APP_URL)).toBe(true);
  });

  it.each(["https://evil.example", "http://app.veldocs.example", "https://app.veldocs.example.evil.com", "null"])(
    "recusa Origin %j",
    (origin) => {
      expect(isSameOriginRequest(jsonRequest("{}", { origin }), APP_URL)).toBe(false);
    },
  );

  it("sem Origin, só aceita Sec-Fetch-Site same-origin", () => {
    expect(isSameOriginRequest(jsonRequest("{}", { "sec-fetch-site": "same-origin" }), APP_URL)).toBe(true);
    expect(isSameOriginRequest(jsonRequest("{}", { "sec-fetch-site": "cross-site" }), APP_URL)).toBe(false);
    expect(isSameOriginRequest(jsonRequest("{}"), APP_URL)).toBe(false);
  });
});

describe("readJsonBody", () => {
  it("lê JSON válido", async () => {
    await expect(readJsonBody(jsonRequest('{"a":1}'))).resolves.toEqual({ ok: true, data: { a: 1 } });
  });

  it("recusa tipo de conteúdo diferente de JSON", async () => {
    const request = new Request(`${APP_URL}/x`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    await expect(readJsonBody(request)).resolves.toMatchObject({ ok: false, status: 415 });
  });

  it("recusa JSON malformado", async () => {
    await expect(readJsonBody(jsonRequest("{"))).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("recusa corpo maior que o limite, mesmo sem Content-Length confiável", async () => {
    const big = JSON.stringify({ data: "x".repeat(MAX_JSON_BODY_BYTES) });
    await expect(readJsonBody(jsonRequest(big))).resolves.toMatchObject({ ok: false, status: 413 });
    await expect(readJsonBody(jsonRequest('{"a":1}', { "content-length": "999999" }))).resolves.toMatchObject({
      ok: false,
      status: 413,
    });
  });
});

describe("sessionCookieSettings", () => {
  it("em HTTPS usa prefixo __Host-, Secure, HttpOnly e SameSite=Lax", () => {
    expect(sessionCookieSettings(APP_URL)).toEqual({
      name: "__Host-veldocs_session",
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    });
  });

  it("em HTTP local não usa Secure nem o prefixo", () => {
    expect(sessionCookieSettings("http://localhost:3000")).toEqual({
      name: "veldocs_session",
      options: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
    });
  });
});
