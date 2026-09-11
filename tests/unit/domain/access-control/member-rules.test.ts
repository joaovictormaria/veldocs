import { describe, expect, it } from "vitest";
import { canGrantRoles, canManageMember } from "@/domain/access-control/member-rules";

describe("regras de perfis entre membros", () => {
  it("só Proprietário concede o perfil Proprietário", () => {
    expect(canGrantRoles(["OWNER"], ["OWNER"])).toBe(true);
    expect(canGrantRoles(["ADMIN"], ["OWNER"])).toBe(false);
    expect(canGrantRoles(["ADMIN"], ["GESTOR", "OWNER"])).toBe(false);
  });

  it("perfis que não são Proprietário podem ser concedidos por quem gerencia membros", () => {
    expect(canGrantRoles(["ADMIN"], ["ADMIN"])).toBe(true);
    expect(canGrantRoles(["ADMIN"], ["GESTOR", "COLABORADOR"])).toBe(true);
  });

  it("só Proprietário altera, suspende ou remove outro Proprietário", () => {
    expect(canManageMember(["OWNER"], ["OWNER"])).toBe(true);
    expect(canManageMember(["ADMIN"], ["OWNER"])).toBe(false);
    expect(canManageMember(["ADMIN"], ["ADMIN"])).toBe(true);
    expect(canManageMember(["ADMIN"], ["GESTOR"])).toBe(true);
  });
});
