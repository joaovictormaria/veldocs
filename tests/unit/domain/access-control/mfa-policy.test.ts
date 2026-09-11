import { describe, expect, it } from "vitest";
import { MFA_REQUIRED_ROLE_KEYS, requiresMfa } from "@/domain/access-control/mfa-policy";
import {
  formatRecoveryCode,
  isValidRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from "@/domain/identity/recovery-code";

describe("política de MFA", () => {
  it("exige segundo fator apenas para OWNER e ADMIN", () => {
    expect([...MFA_REQUIRED_ROLE_KEYS].sort()).toEqual(["ADMIN", "OWNER"]);
  });

  it.each([
    [["OWNER"], true],
    [["ADMIN"], true],
    [["GESTOR", "ADMIN"], true],
    [["GESTOR"], false],
    [["COLABORADOR", "VISUALIZADOR"], false],
    [[], false],
    [["PERFIL_PERSONALIZADO"], false],
  ])("perfis %j exigem MFA: %s", (roleKeys, expected) => {
    expect(requiresMfa(roleKeys)).toBe(expected);
  });
});

describe("códigos de recuperação", () => {
  it("são 10 códigos de 10 caracteres", () => {
    expect({ RECOVERY_CODE_COUNT, RECOVERY_CODE_LENGTH }).toEqual({ RECOVERY_CODE_COUNT: 10, RECOVERY_CODE_LENGTH: 10 });
  });

  it("aceita a digitação com hífen, espaços e minúsculas", () => {
    expect(normalizeRecoveryCode("abcde-fghij")).toBe("ABCDEFGHIJ");
    expect(normalizeRecoveryCode(" ABCDE FGHIJ ")).toBe("ABCDEFGHIJ");
    expect(isValidRecoveryCode("abcde-fghij")).toBe(true);
  });

  it.each(["ABCDEFGHI", "ABCDEFGHIJK", "ABCDE-FGHI1", "ABCDE-FGHI0", "", "!!!!!!!!!!"])(
    "recusa %j",
    (code) => {
      expect(isValidRecoveryCode(code)).toBe(false);
    },
  );

  it("formata em dois grupos de cinco", () => {
    expect(formatRecoveryCode("ABCDEFGHIJ")).toBe("ABCDE-FGHIJ");
  });
});
