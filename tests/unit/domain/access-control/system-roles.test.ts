import { describe, expect, it } from "vitest";
import { permissionKeySchema } from "@/domain/access-control/permission-key";
import {
  ALL_PERMISSIONS,
  COMPANY_CREATOR_ROLE,
  PERMISSION_CATALOG,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLES,
} from "@/domain/access-control/system-roles";
import { buildCompanySlug, slugifyCompanyName } from "@/domain/company/slug";

describe("catálogo de permissões", () => {
  it.each(Object.keys(PERMISSION_CATALOG))("%s segue o formato recurso.acao", (key) => {
    expect(permissionKeySchema.safeParse(key).success).toBe(true);
  });

  it("não tem descrições vazias", () => {
    expect(Object.values(PERMISSION_CATALOG).every((description) => description.trim().length > 0)).toBe(true);
  });
});

describe("perfis padrão", () => {
  it("define os cinco perfis do MASTER SPEC", () => {
    expect(Object.keys(SYSTEM_ROLES).sort()).toEqual([...SYSTEM_ROLE_KEYS].sort());
  });

  it("OWNER e ADMIN têm todas as permissões e exigem MFA", () => {
    for (const key of ["OWNER", "ADMIN"] as const) {
      expect([...SYSTEM_ROLES[key].permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
      expect(SYSTEM_ROLES[key].requiresMfa).toBe(true);
    }
  });

  it("somente OWNER e ADMIN exigem MFA", () => {
    const requiringMfa = SYSTEM_ROLE_KEYS.filter((key) => SYSTEM_ROLES[key].requiresMfa);
    expect(requiringMfa).toEqual(["OWNER", "ADMIN"]);
  });

  it("VISUALIZADOR só tem permissões de leitura", () => {
    expect(SYSTEM_ROLES.VISUALIZADOR.permissions.every((key) => key.endsWith(".read"))).toBe(true);
  });

  it("perfis não administrativos não gerenciam membros nem perfis", () => {
    for (const key of ["GESTOR", "COLABORADOR", "VISUALIZADOR"] as const) {
      expect(SYSTEM_ROLES[key].permissions).not.toContain("members.manage");
      expect(SYSTEM_ROLES[key].permissions).not.toContain("roles.manage");
    }
  });

  it("perfis não repetem permissões e o criador da empresa é OWNER", () => {
    for (const key of SYSTEM_ROLE_KEYS) {
      const permissions = SYSTEM_ROLES[key].permissions;
      expect(new Set(permissions).size).toBe(permissions.length);
    }
    expect(COMPANY_CREATOR_ROLE).toBe("OWNER");
  });
});

describe("slug da empresa", () => {
  it.each([
    ["Padaria São João Ltda.", "padaria-sao-joao-ltda"],
    ["  ACME   Indústria & Comércio  ", "acme-industria-comercio"],
    ["!!!", "empresa"],
    ["", "empresa"],
  ])("converte %j em %j", (name, slug) => {
    expect(slugifyCompanyName(name)).toBe(slug);
  });

  it("limita o tamanho e não termina com hífen", () => {
    const slug = slugifyCompanyName(`${"a".repeat(59)} bcdef`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("acrescenta sufixo aleatório validado", () => {
    expect(buildCompanySlug("Padaria São João", "a1b2c3")).toBe("padaria-sao-joao-a1b2c3");
    expect(() => buildCompanySlug("Padaria", "../x")).toThrow();
  });
});
