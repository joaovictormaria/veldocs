import { describe, expect, it } from "vitest";
import {
  addDays,
  daysUntil,
  EXPIRATION_STATUSES,
  EXPIRATIONS_MODULE_KEY,
  EXPIRING_WINDOW_DAYS,
  expirationStatus,
  expiringWindowEnd,
  todayInBrazil,
} from "@/domain/documents/expiration";

const HOJE = "2026-09-11";

describe("hoje em Brasília", () => {
  it("usa o dia de quem está no Brasil, não o do servidor em UTC", () => {
    // 02:00 UTC do dia 12 ainda é dia 11 em São Paulo (UTC-3).
    expect(todayInBrazil(new Date("2026-09-12T02:00:00.000Z"))).toBe("2026-09-11");
    expect(todayInBrazil(new Date("2026-09-12T03:00:00.000Z"))).toBe("2026-09-12");
    expect(todayInBrazil(new Date("2026-09-11T12:00:00.000Z"))).toBe("2026-09-11");
  });
});

describe("contas com datas de calendário", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(addDays("2026-09-11", 30)).toBe("2026-10-11");
    expect(addDays("2026-12-20", 15)).toBe("2027-01-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("conta os dias que faltam, negativo quando já passou", () => {
    expect(daysUntil("2026-09-11", HOJE)).toBe(0);
    expect(daysUntil("2026-09-12", HOJE)).toBe(1);
    expect(daysUntil("2026-09-01", HOJE)).toBe(-10);
  });

  it("a janela do alerta é de 30 dias", () => {
    expect(EXPIRING_WINDOW_DAYS).toBe(30);
    expect(expiringWindowEnd(HOJE)).toBe("2026-10-11");
    expect(expiringWindowEnd(HOJE, 7)).toBe("2026-09-18");
  });
});

describe("situação de vencimento", () => {
  it("documento sem validade não vence", () => {
    expect(expirationStatus(null, HOJE)).toBe("NO_EXPIRATION");
  });

  it("vence hoje: ainda vale, mas está na janela do alerta", () => {
    expect(expirationStatus(HOJE, HOJE)).toBe("EXPIRING");
  });

  it("ontem já é vencido", () => {
    expect(expirationStatus("2026-09-10", HOJE)).toBe("EXPIRED");
    expect(expirationStatus("2020-01-01", HOJE)).toBe("EXPIRED");
  });

  it("dentro da janela é 'vencendo'; depois dela, válido", () => {
    expect(expirationStatus("2026-10-11", HOJE)).toBe("EXPIRING");
    expect(expirationStatus("2026-10-12", HOJE)).toBe("VALID");
    expect(expirationStatus("2027-01-01", HOJE)).toBe("VALID");
  });

  it("a janela pode ser encurtada", () => {
    expect(expirationStatus("2026-09-20", HOJE, 7)).toBe("VALID");
    expect(expirationStatus("2026-09-18", HOJE, 7)).toBe("EXPIRING");
  });

  it("as situações conhecidas e o módulo que as libera são explícitos", () => {
    expect([...EXPIRATION_STATUSES]).toEqual(["VALID", "EXPIRING", "EXPIRED", "NO_EXPIRATION"]);
    expect(EXPIRATIONS_MODULE_KEY).toBe("vencimentos");
  });
});
