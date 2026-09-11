import { describe, expect, it } from "vitest";
import { INVITATION_TTL_DAYS, invitationExpiresAt, maskEmail } from "@/domain/identity/invitation";

describe("convites", () => {
  it("valem 7 dias", () => {
    const from = new Date("2026-09-11T12:00:00.000Z");
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(invitationExpiresAt(from).toISOString()).toBe("2026-09-18T12:00:00.000Z");
  });

  it.each([
    ["nova.pessoa@example.com", "no***@example.com"],
    ["ana@empresa.com.br", "an***@empresa.com.br"],
    ["ab@x.io", "a***@x.io"],
    ["a@x.io", "a***@x.io"],
    ["sem-arroba", "***"],
    ["@x.io", "***"],
  ])("mascara %s como %s", (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it("nunca mostra o endereço inteiro de quem tem mais de uma letra antes da arroba", () => {
    for (const email of ["joao@example.com", "maria.silva@example.com", "ab@example.com"]) {
      const local = email.slice(0, email.indexOf("@"));
      expect(maskEmail(email).startsWith(local)).toBe(false);
    }
  });
});
