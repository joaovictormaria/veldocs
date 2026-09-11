import { describe, expect, it } from "vitest";
import {
  bypassesSubscription,
  CORE_MODULE_KEY,
  MODULE_KEYS,
  moduleOfPermission,
  PERMISSION_MODULE,
  SUBSCRIPTION_EXEMPT_PERMISSIONS,
} from "@/domain/access-control/permission-modules";
import { ALL_PERMISSIONS } from "@/domain/access-control/system-roles";

describe("módulo de cada permissão", () => {
  it("toda permissão do catálogo pertence a um módulo conhecido", () => {
    expect(Object.keys(PERMISSION_MODULE).sort()).toEqual([...ALL_PERMISSIONS].sort());
    for (const permission of ALL_PERMISSIONS) {
      expect(MODULE_KEYS).toContain(moduleOfPermission(permission));
    }
  });

  it("as permissões existentes são todas do Core", () => {
    // As capacidades dos módulos pagos ainda não existem; quando existirem,
    // cada uma trará suas permissões e este teste deixa de valer.
    expect(new Set(Object.values(PERMISSION_MODULE))).toEqual(new Set([CORE_MODULE_KEY]));
  });

  it("as chaves de módulo vêm do catálogo comercial", () => {
    expect(MODULE_KEYS[0]).toBe(CORE_MODULE_KEY);
    expect(MODULE_KEYS.length).toBeGreaterThan(1);
  });
});

describe("permissões que valem com a assinatura inválida", () => {
  it("são só as de assinatura — nada do negócio escapa do bloqueio", () => {
    expect([...SUBSCRIPTION_EXEMPT_PERMISSIONS].sort()).toEqual(["billing.manage", "billing.read"]);
    for (const permission of ALL_PERMISSIONS) {
      expect(bypassesSubscription(permission), permission).toBe(permission.startsWith("billing."));
    }
  });
});
