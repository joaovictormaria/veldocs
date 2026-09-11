import { describe, expect, it } from "vitest";
import { DASHBOARD_ACTIVITY_ACTIONS } from "@/application/dashboard/dashboard-queries";
import { activityLabel, timeAgo } from "@/presentation/activity";
import { expirationPhrase } from "@/presentation/documents";

describe("frases da atividade recente", () => {
  it("toda ação exibida no painel tem frase própria", () => {
    const semFrase = DASHBOARD_ACTIVITY_ACTIONS.filter((action) => activityLabel(action) === "registrou uma atividade");
    expect(semFrase).toEqual([]);
  });

  it("descreve as ações mais comuns", () => {
    expect(activityLabel("document.renewed")).toBe("renovou o documento");
    expect(activityLabel("category.created")).toBe("criou a categoria");
    expect(activityLabel("subscription.trial_started")).toBe("iniciou o teste grátis");
  });

  it("ação desconhecida não quebra a tela", () => {
    expect(activityLabel("algo.novo")).toBe("registrou uma atividade");
  });
});

describe("tempo decorrido", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");

  it.each([
    ["2026-09-11T11:59:40.000Z", "agora"],
    ["2026-09-11T11:55:00.000Z", "há 5 min"],
    ["2026-09-11T09:00:00.000Z", "há 3 h"],
    ["2026-09-10T11:00:00.000Z", "ontem"],
    ["2026-09-07T12:00:00.000Z", "há 4 dias"],
  ])("%s → %s", (value, expected) => {
    expect(timeAgo(value, now)).toBe(expected);
  });

  it("relógio adiantado no cliente não gera tempo negativo", () => {
    expect(timeAgo("2026-09-11T12:05:00.000Z", now)).toBe("agora");
  });
});

describe("prazo em palavras", () => {
  it.each([
    [0, "vence hoje"],
    [1, "vence em 1 dia"],
    [12, "vence em 12 dias"],
    [-1, "venceu há 1 dia"],
    [-30, "venceu há 30 dias"],
  ])("%i → %s", (days, expected) => {
    expect(expirationPhrase(days)).toBe(expected);
  });
});
