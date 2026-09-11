import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  generateNonce,
} from "@/infrastructure/http/security-headers";

const production = { nonce: "n0nc3", isDevelopment: false, isHttps: true };

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name as string, values.join(" ")];
    }),
  );

describe("Content-Security-Policy", () => {
  it("assina os scripts com o nonce da requisição e não permite inline", () => {
    const csp = directives(buildContentSecurityPolicy(production));

    expect(csp["script-src"]).toBe("'self' 'nonce-n0nc3' 'strict-dynamic'");
    expect(csp["script-src"]).not.toContain("unsafe-inline");
    expect(csp["script-src"]).not.toContain("unsafe-eval");
  });

  it("bloqueia enquadramento, objetos e base-uri estrangeira", () => {
    const csp = directives(buildContentSecurityPolicy(production));

    expect(csp["default-src"]).toBe("'self'");
    expect(csp["frame-ancestors"]).toBe("'none'");
    expect(csp["object-src"]).toBe("'none'");
    expect(csp["base-uri"]).toBe("'self'");
    expect(csp["form-action"]).toBe("'self'");
  });

  it("libera para conexões só a própria aplicação e, quando configurado, o bucket de arquivos", () => {
    expect(directives(buildContentSecurityPolicy(production))["connect-src"]).toBe("'self'");
    expect(
      directives(buildContentSecurityPolicy({ ...production, connectSources: ["https://veldocs.storage.example"] }))[
        "connect-src"
      ],
    ).toBe("'self' https://veldocs.storage.example");
  });

  it("permite eval apenas em desenvolvimento (usado pelo React)", () => {
    expect(buildContentSecurityPolicy({ ...production, isDevelopment: true })).toContain("'unsafe-eval'");
  });
});

describe("headers de segurança", () => {
  it("inclui as proteções básicas", () => {
    expect(buildSecurityHeaders(production)).toMatchObject({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    expect(buildSecurityHeaders(production)["Permissions-Policy"]).toContain("camera=()");
  });

  it("envia HSTS somente em HTTPS", () => {
    expect(buildSecurityHeaders(production)["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(buildSecurityHeaders({ ...production, isHttps: false })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("nonce", () => {
  it("é diferente a cada requisição", () => {
    const nonces = new Set(Array.from({ length: 20 }, () => generateNonce()));
    expect(nonces.size).toBe(20);
  });
});
