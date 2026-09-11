import { describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createSubscriptionUseCases } from "@/application/billing/subscription-use-cases";
import type { BillingCatalogRepository, CatalogKit, CatalogModule } from "@/application/ports/billing-catalog";
import {
  type NewTrial,
  type StoredSubscription,
  type SubscriptionRepository,
  TrialAlreadyStartedError,
} from "@/application/ports/subscription-repository";
import { MODULE_KEYS } from "@/domain/billing/module-catalog";
import { createFakeAudit } from "../auth/fakes";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-11T12:00:00.000Z");
const context: AuthorizedContext = {
  companyId: "company-1",
  userId: "user-1",
  roleKeys: ["OWNER"],
  permissions: ["billing.read", "billing.manage"],
};
const request = { ipAddress: "203.0.113.9", userAgent: "vitest" };

const entry = (key: string, name: string, cents: number | null, status: CatalogModule["status"] = "AVAILABLE") => ({
  key,
  name,
  description: "descrição",
  benefit: "benefício do módulo",
  isCore: key === "core",
  status,
  dependsOn: [],
  monthlyPriceCents: cents,
  currency: cents === null ? null : "BRL",
});

const MODULES: CatalogModule[] = [
  entry("core", "Core", 4990),
  entry("vencimentos", "Controle de vencimentos", 1990),
  entry("funcionarios", "Funcionários", 2990),
  entry("contratos", "Contratos", 3990),
  entry("ocr", "OCR", 3990, "COMING_SOON"),
  entry("aprovacoes", "Aprovações", null),
];

const KITS: CatalogKit[] = [
  {
    key: "equipe",
    name: "Equipe",
    audience: "teste",
    modules: ["core", "vencimentos", "funcionarios"],
    monthlyPriceCents: 5990,
    currency: "BRL",
  },
  { key: "sem-preco", name: "Sem preço", audience: "teste", modules: ["core"], monthlyPriceCents: null, currency: null },
];

const catalog: BillingCatalogRepository = {
  listCatalog: async () => MODULES,
  listKits: async () => KITS,
};

function setup(options: { stored?: StoredSubscription | null; raceOnStart?: boolean } = {}) {
  let stored = options.stored ?? null;
  const active = new Set<string>(["core"]);
  const trials: NewTrial[] = [];

  const repository: SubscriptionRepository = {
    async findByCompany(companyId) {
      return companyId === context.companyId ? stored : null;
    },
    async listActiveModules() {
      return MODULE_KEYS.filter((key) => active.has(key));
    },
    async startTrial(trial) {
      if (options.raceOnStart || stored) throw new TrialAlreadyStartedError();
      trials.push(trial);
      for (const key of trial.modules) active.add(key);
      stored = {
        status: "TRIALING",
        kitKey: trial.kitKey,
        trialStartedAt: trial.startedAt,
        trialEndsAt: trial.endsAt,
        canceledAt: null,
        suspendedAt: null,
        reactivatedAt: null,
      };
      return { id: "subscription-1" };
    },
  };

  const audit = createFakeAudit();
  const useCases = createSubscriptionUseCases({ repository, catalog, audit: audit.audit, now: () => NOW });
  return { useCases, trials, events: audit.events };
}

const subscription = (overrides: Partial<StoredSubscription>): StoredSubscription => ({
  status: "TRIALING",
  kitKey: null,
  trialStartedAt: null,
  trialEndsAt: null,
  canceledAt: null,
  suspendedAt: null,
  reactivatedAt: null,
  ...overrides,
});

describe("situação da assinatura", () => {
  it("sem assinatura: ainda no Builder, com o Core liberado e valor mensal indefinido", async () => {
    await expect(setup().useCases.getSummary(context)).resolves.toEqual({
      status: "NOT_STARTED",
      hasAccess: true,
      trial: null,
      kit: null,
      modules: [{ key: "core", name: "Core" }],
      monthlyTotalCents: null,
      currency: "BRL",
      dataRetentionUntil: null,
    });
  });

  it("trial vencido: sem acesso, 0 dias restantes e o valor que será cobrado", async () => {
    const { useCases } = setup({
      stored: subscription({ trialStartedAt: new Date(NOW.getTime() - 15 * DAY), trialEndsAt: new Date(NOW.getTime() - DAY) }),
    });

    await expect(useCases.getSummary(context)).resolves.toMatchObject({
      status: "TRIAL_EXPIRED",
      hasAccess: false,
      trial: { daysRemaining: 0 },
      monthlyTotalCents: 4990,
    });
  });

  it("cancelada: sem acesso e com a data até quando os dados ficam guardados", async () => {
    const { useCases } = setup({ stored: subscription({ status: "CANCELED", canceledAt: NOW }) });

    await expect(useCases.getSummary(context)).resolves.toMatchObject({
      status: "CANCELED",
      hasAccess: false,
      trial: null,
      dataRetentionUntil: new Date(NOW.getTime() + 365 * DAY),
    });
  });
});

describe("início do trial", () => {
  it("kit + módulo avulso: 14 dias, módulos resolvidos, valor mensal e auditoria", async () => {
    const { useCases, trials, events } = setup();

    const result = await useCases.startTrial(context, { kitKey: "equipe", modules: ["contratos"] }, request);

    expect(trials).toEqual([
      {
        companyId: "company-1",
        kitKey: "equipe",
        modules: ["core", "vencimentos", "funcionarios", "contratos"],
        startedAt: NOW,
        endsAt: new Date(NOW.getTime() + 14 * DAY),
      },
    ]);
    expect(result).toMatchObject({
      ok: true,
      subscription: {
        status: "TRIAL_ACTIVE",
        hasAccess: true,
        trial: { startedAt: NOW, daysRemaining: 14 },
        kit: { key: "equipe", name: "Equipe" },
        monthlyTotalCents: 9980,
      },
    });
    expect(events).toEqual([
      expect.objectContaining({
        companyId: "company-1",
        actorUserId: "user-1",
        action: "subscription.trial_started",
        entityId: "subscription-1",
        metadata: { kitKey: "equipe", modules: "core,vencimentos,funcionarios,contratos", monthlyTotalCents: 9980, trialDays: 14 },
      }),
    ]);
  });

  it("sem kit, cobra o Core e os módulos escolhidos", async () => {
    const result = await setup().useCases.startTrial(context, { modules: ["vencimentos"] }, request);
    expect(result).toMatchObject({ ok: true, subscription: { kit: null, monthlyTotalCents: 6980 } });
  });

  it("recusa módulo e kit inexistentes sem criar nada", async () => {
    const { useCases, trials, events } = setup();

    const result = await useCases.startTrial(context, { kitKey: "kit-x", modules: ["modulo-x"] }, request);

    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      issues: [
        { field: "modules", message: "módulo inexistente: modulo-x" },
        { field: "kitKey", message: "kit inexistente ou sem preço vigente" },
      ],
    });
    expect(trials).toEqual([]);
    expect(events).toEqual([]);
  });

  it("recusa kit sem preço vigente, módulo indisponível e módulo sem preço", async () => {
    const { useCases } = setup();

    expect(await useCases.startTrial(context, { kitKey: "sem-preco" }, request)).toMatchObject({
      ok: false,
      issues: [{ field: "kitKey" }],
    });
    expect(await useCases.startTrial(context, { modules: ["ocr"] }, request)).toMatchObject({
      ok: false,
      issues: [{ field: "modules", message: "módulo indisponível: ocr" }],
    });
    expect(await useCases.startTrial(context, { modules: ["aprovacoes"] }, request)).toMatchObject({
      ok: false,
      issues: [{ field: "modules", message: "módulo sem preço vigente: aprovacoes" }],
    });
  });

  it("recusa entrada em formato inválido", async () => {
    expect(await setup().useCases.startTrial(context, { modules: "vencimentos" }, request)).toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("não inicia o trial duas vezes", async () => {
    const { useCases } = setup();
    await useCases.startTrial(context, { modules: [] }, request);

    await expect(useCases.startTrial(context, { modules: [] }, request)).resolves.toEqual({
      ok: false,
      reason: "trial_already_started",
    });
  });

  it("duas requisições simultâneas: a unicidade no banco decide, sem auditar a perdedora", async () => {
    const { useCases, events } = setup({ raceOnStart: true });

    await expect(useCases.startTrial(context, { modules: [] }, request)).resolves.toEqual({
      ok: false,
      reason: "trial_already_started",
    });
    expect(events).toEqual([]);
  });
});
