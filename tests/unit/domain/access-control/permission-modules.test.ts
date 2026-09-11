import { describe, expect, it } from "vitest";
import {
  CORE_MODULE_KEY,
  MODULE_KEYS,
  moduleOfPermission,
  PERMISSION_MODULE,
} from "@/domain/access-control/permission-modules";
import { ALL_PERMISSIONS } from "@/domain/access-control/system-roles";

describe("módulo de cada permissão", () => {
  it("toda permissão do catálogo pertence a um módulo conhecido", () => {
    expect(Object.keys(PERMISSION_MODULE).sort()).toEqual([...ALL_PERMISSIONS].sort());
    for (const permission of ALL_PERMISSIONS) {
      expect(MODULE_KEYS).toContain(moduleOfPermission(permission));
    }
  });

  it("antes da FASE 3 todas as permissões pertencem ao Core", () => {
    expect(MODULE_KEYS).toEqual([CORE_MODULE_KEY]);
    expect(new Set(Object.values(PERMISSION_MODULE))).toEqual(new Set([CORE_MODULE_KEY]));
  });
});
