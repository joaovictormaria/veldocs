import { describe, expect, it } from "vitest";
import {
  canTransition,
  DATA_RETENTION_DAYS,
  dataRetentionUntil,
  EFFECTIVE_STATUSES,
  effectiveStatus,
  grantsAccess,
  isReactivation,
  isRetentionExpired,
  SUBSCRIPTION_STATUSES,
  TRIAL_DAYS,
  trialDaysRemaining,
  trialEndFrom,
} from "@/domain/billing/subscription-status";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-09-11T12:00:00.000Z");
const at = (days: number) => new Date(start.getTime() + days * DAY);

const trialing = (trialEndsAt: Date | null) => ({ status: "TRIALING" as const, trialEndsAt, reactivatedAt: null });

describe("trial de 14 dias", () => {
  it("termina exatamente 14 dias após o início", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(trialEndFrom(start).toISOString()).toBe(at(14).toISOString());
  });

  it("fica ativo até faltarem 3 dias", () => {
    const end = trialEndFrom(start);

    expect(effectiveStatus(trialing(end), at(0))).toBe("TRIAL_ACTIVE");
    expect(effectiveStatus(trialing(end), at(10.9))).toBe("TRIAL_ACTIVE");
  });

  it("passa a 'terminando' nos últimos 3 dias", () => {
    const end = trialEndFrom(start);

    expect(effectiveStatus(trialing(end), at(11))).toBe("TRIAL_EXPIRING");
    expect(effectiveStatus(trialing(end), at(13.99))).toBe("TRIAL_EXPIRING");
  });

  it("expira no instante do término, sem precisar de processo agendado", () => {
    const end = trialEndFrom(start);

    expect(effectiveStatus(trialing(end), at(14))).toBe("TRIAL_EXPIRED");
    expect(effectiveStatus(trialing(end), at(200))).toBe("TRIAL_EXPIRED");
  });

  it("conta os dias restantes arredondando para cima e nunca negativo", () => {
    const end = trialEndFrom(start);

    expect(trialDaysRemaining(end, at(0))).toBe(14);
    expect(trialDaysRemaining(end, at(13.5))).toBe(1);
    expect(trialDaysRemaining(end, at(14))).toBe(0);
    expect(trialDaysRemaining(end, at(30))).toBe(0);
    expect(trialDaysRemaining(null, at(0))).toBeNull();
  });
});

describe("estados fora do trial", () => {
  it("repete o estado gravado", () => {
    for (const status of ["ACTIVE", "PAYMENT_PENDING", "PAST_DUE", "CANCELED", "SUSPENDED"] as const) {
      expect(effectiveStatus({ status, trialEndsAt: null, reactivatedAt: null }, start)).toBe(status);
    }
  });

  it("assinatura ativa que já foi reativada aparece como REACTIVATED", () => {
    expect(effectiveStatus({ status: "ACTIVE", trialEndsAt: null, reactivatedAt: start }, start)).toBe("REACTIVATED");
  });

  it("todo estado derivado está entre os estados esperados pela spec", () => {
    const derived = new Set<string>();
    for (const status of SUBSCRIPTION_STATUSES) {
      for (const days of [0, 12, 20]) {
        derived.add(effectiveStatus({ status, trialEndsAt: trialEndFrom(start), reactivatedAt: null }, at(days)));
      }
    }
    derived.add(effectiveStatus({ status: "ACTIVE", trialEndsAt: null, reactivatedAt: start }, start));

    expect([...derived].sort()).toEqual([...EFFECTIVE_STATUSES].sort());
  });
});

describe("acesso ao sistema (DEC-022)", () => {
  it("liberado em trial vigente, ativo, reativado e pagamento em processamento", () => {
    for (const status of ["TRIAL_ACTIVE", "TRIAL_EXPIRING", "ACTIVE", "REACTIVATED", "PAYMENT_PENDING"] as const) {
      expect(grantsAccess(status), status).toBe(true);
    }
  });

  it("bloqueado com trial vencido, atraso, cancelamento e suspensão — sem carência", () => {
    for (const status of ["TRIAL_EXPIRED", "PAST_DUE", "CANCELED", "SUSPENDED"] as const) {
      expect(grantsAccess(status), status).toBe(false);
    }
  });

  it("todo estado possível tem uma regra explícita", () => {
    const allowed = EFFECTIVE_STATUSES.filter((status) => grantsAccess(status));
    const blocked = EFFECTIVE_STATUSES.filter((status) => !grantsAccess(status));

    expect(allowed.length + blocked.length).toBe(EFFECTIVE_STATUSES.length);
    expect([...blocked].sort()).toEqual(["CANCELED", "PAST_DUE", "SUSPENDED", "TRIAL_EXPIRED"]);
  });
});

describe("transições", () => {
  it("o trial pode virar assinatura, ficar pendente, ser cancelado ou suspenso", () => {
    expect(canTransition("TRIALING", "ACTIVE")).toBe(true);
    expect(canTransition("TRIALING", "PAYMENT_PENDING")).toBe(true);
    expect(canTransition("TRIALING", "CANCELED")).toBe(true);
  });

  it("não se volta ao trial depois de sair dele", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(canTransition(status, "TRIALING"), status).toBe(false);
    }
  });

  it("nenhum estado transita para ele mesmo", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(canTransition(status, status), status).toBe(false);
    }
  });

  it("voltar de cancelada ou suspensa para ativa é reativação", () => {
    expect(isReactivation("CANCELED", "ACTIVE")).toBe(true);
    expect(isReactivation("SUSPENDED", "ACTIVE")).toBe(true);
    expect(isReactivation("PAST_DUE", "ACTIVE")).toBe(false);
    expect(isReactivation("TRIALING", "ACTIVE")).toBe(false);
  });
});

describe("retenção de dados após cancelamento ou suspensão (DEC-025)", () => {
  const state = (
    status: (typeof SUBSCRIPTION_STATUSES)[number],
    dates: { canceledAt?: Date | null; suspendedAt?: Date | null } = {},
  ) => ({ status, canceledAt: dates.canceledAt ?? null, suspendedAt: dates.suspendedAt ?? null });

  it("cancelada: dados e login guardados por 1 ano", () => {
    expect(DATA_RETENTION_DAYS.CANCELED).toBe(365);
    expect(dataRetentionUntil(state("CANCELED", { canceledAt: start }))?.toISOString()).toBe(at(365).toISOString());
  });

  it("suspensa: dados guardados por 2 meses (60 dias)", () => {
    expect(DATA_RETENTION_DAYS.SUSPENDED).toBe(60);
    expect(dataRetentionUntil(state("SUSPENDED", { suspendedAt: start }))?.toISOString()).toBe(at(60).toISOString());
  });

  it("sem a data de início não há prazo, e os demais estados não têm retenção", () => {
    expect(dataRetentionUntil(state("CANCELED"))).toBeNull();
    expect(dataRetentionUntil(state("SUSPENDED"))).toBeNull();
    expect(dataRetentionUntil(state("ACTIVE", { canceledAt: start, suspendedAt: start }))).toBeNull();
    expect(dataRetentionUntil(state("TRIALING"))).toBeNull();
  });

  it("o prazo vence no instante final — só então a conta pode ser apagada", () => {
    const suspended = state("SUSPENDED", { suspendedAt: start });

    expect(isRetentionExpired(suspended, at(59.99))).toBe(false);
    expect(isRetentionExpired(suspended, at(60))).toBe(true);
    expect(isRetentionExpired(state("ACTIVE"), at(1000))).toBe(false);
  });

  it("guardar os dados não libera acesso: cancelada e suspensa seguem bloqueadas", () => {
    expect(grantsAccess("CANCELED")).toBe(false);
    expect(grantsAccess("SUSPENDED")).toBe(false);
  });
});
