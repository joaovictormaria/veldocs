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

  it("a gestão documental é do Core e o controle de vencimentos é do módulo pago", () => {
    const byModule = (module: string) =>
      ALL_PERMISSIONS.filter((permission) => moduleOfPermission(permission) === module).sort();

    expect(byModule("vencimentos")).toEqual(["expirations.manage", "expirations.read"]);
    // Todo o resto continua no Core: quem não paga módulo nenhum usa o sistema.
    expect(byModule(CORE_MODULE_KEY)).toEqual(
      ALL_PERMISSIONS.filter((permission) => !permission.startsWith("expirations.")).sort(),
    );
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
