import { describe, expect, it } from "vitest";
import type { AuthorizationFailure } from "@/application/access/authorize";
import { createCoreOnlyEntitlementService } from "@/infrastructure/access/core-only-entitlements";
import { authorizationFailureResponse } from "@/infrastructure/http/authorization-responses";

describe("respostas de autorização", () => {
  it.each<[AuthorizationFailure, number]>([
    ["unauthenticated", 401],
    ["active_company_required", 403],
    ["forbidden", 403],
    ["module_not_enabled", 403],
  ])("%s → HTTP %i com código estável e sem cache", async (reason, status) => {
    const response = authorizationFailureResponse(reason);

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe(reason);
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe("entitlements provisórios (até a FASE 3)", () => {
  it("Core sempre ativo; qualquer outro módulo negado", async () => {
    const service = createCoreOnlyEntitlementService();

    await expect(service.isModuleEnabled("empresa", "core")).resolves.toBe(true);
    await expect(service.isModuleEnabled("empresa", "whatsapp" as never)).resolves.toBe(false);
  });
});
