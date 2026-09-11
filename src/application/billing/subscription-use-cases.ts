import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { BillingCatalogRepository, CatalogKit } from "@/application/ports/billing-catalog";
import {
  type StoredSubscription,
  SubscriptionNotInTrialError,
  type SubscriptionRepository,
  TrialAlreadyStartedError,
} from "@/application/ports/subscription-repository";
import { MODULE_KEYS } from "@/domain/billing/module-catalog";
import { type KitOffer, type KitQuote, type MonthlyQuote, quoteKit, quoteMonthly } from "@/domain/billing/pricing";
import {
  canChangeModules,
  dataRetentionUntil,
  type EffectiveStatus,
  effectiveStatus,
  grantsAccess,
  TRIAL_DAYS,
  trialDaysRemaining,
  trialEndFrom,
} from "@/domain/billing/subscription-status";

export const SUBSCRIPTION_AUDIT_ACTIONS = {
  trialStarted: "subscription.trial_started",
  modulesChanged: "subscription.modules_changed",
} as const;

/** Chave opcional: ausente, nula ou vazia viram `null`. */
const optionalKey = z
  .union([z.literal("").transform(() => null), z.string().trim().min(1).max(60)])
  .nullish()
  .transform((value) => value ?? null);

/** Escolha feita no Builder: kit opcional e módulos avulsos. */
export const moduleSelectionInputSchema = z.object({
  kitKey: optionalKey,
  modules: z.array(z.string().trim().min(1).max(60)).max(MODULE_KEYS.length).default([]),
});

type ModuleSelectionInput = z.infer<typeof moduleSelectionInputSchema>;

export interface SubscriptionSummary {
  /** `NOT_STARTED`: a empresa ainda não passou pelo Builder. */
  readonly status: "NOT_STARTED" | EffectiveStatus;
  /** A empresa consegue usar o sistema (DEC-022). */
  readonly hasAccess: boolean;
  /** Kit e módulos podem ser trocados agora (só durante o teste grátis vigente — DEC-030). */
  readonly canChangeModules: boolean;
  /** Presente enquanto a assinatura está em trial. */
  readonly trial: { readonly startedAt: Date | null; readonly endsAt: Date; readonly daysRemaining: number } | null;
  readonly kit: { readonly key: string; readonly name: string } | null;
  readonly modules: readonly { readonly key: string; readonly name: string }[];
  /** Valor mensal com os preços vigentes — o que será cobrado após o trial (MASTER SPEC 2.8). */
  readonly monthlyTotalCents: number | null;
  readonly currency: "BRL";
  /** Até quando os dados ficam guardados em assinatura cancelada ou suspensa (DEC-025). */
  readonly dataRetentionUntil: Date | null;
}

type InvalidInput = { readonly ok: false; readonly reason: "invalid_input"; readonly issues: readonly ValidationIssue[] };

export type StartTrialResult =
  | { readonly ok: true; readonly subscription: SubscriptionSummary }
  | InvalidInput
  | { readonly ok: false; readonly reason: "trial_already_started" };

export type ChangeModulesResult =
  | { readonly ok: true; readonly subscription: SubscriptionSummary }
  | InvalidInput
  | { readonly ok: false; readonly reason: "trial_not_started" | "not_in_trial" };

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const invalid = (issues: readonly ValidationIssue[]): InvalidInput => ({ ok: false, reason: "invalid_input", issues });

const offerOf = (kit: CatalogKit): KitOffer | null =>
  kit.monthlyPriceCents === null ? null : { key: kit.key, modules: kit.modules, priceCents: kit.monthlyPriceCents };

/**
 * Builder (MASTER SPEC 2.4 e 2.8): situação da assinatura, início do trial de
 * 14 dias e troca de kit e módulos durante o trial. A empresa vem sempre do
 * `AuthorizedContext`; preços e disponibilidade vêm sempre do catálogo no servidor.
 */
export function createSubscriptionUseCases(deps: {
  readonly repository: SubscriptionRepository;
  readonly catalog: BillingCatalogRepository;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  const loadCatalog = async (at: Date) => {
    const [modules, kits] = await Promise.all([deps.catalog.listCatalog(at), deps.catalog.listKits(at)]);
    const prices = new Map(
      modules.flatMap((entry) => (entry.monthlyPriceCents === null ? [] : [[entry.key, entry.monthlyPriceCents] as const])),
    );
    return { modules, kits, prices };
  };

  /**
   * Confere a escolha contra o catálogo vigente: módulo e kit existentes,
   * disponíveis e com preço. Devolve o orçamento com os módulos resolvidos.
   */
  const validateSelection = async (
    input: ModuleSelectionInput,
    at: Date,
  ): Promise<
    | { readonly ok: true; readonly offer: KitOffer | null; readonly quote: MonthlyQuote | KitQuote }
    | { readonly ok: false; readonly issues: readonly ValidationIssue[] }
  > => {
    const { modules, kits, prices } = await loadCatalog(at);
    const catalog = new Map(modules.map((entry) => [entry.key, entry]));
    const issues: ValidationIssue[] = [];

    for (const key of new Set(input.modules)) {
      if (!catalog.has(key)) issues.push({ field: "modules", message: `módulo inexistente: ${key}` });
    }
    const kit = input.kitKey ? kits.find((candidate) => candidate.key === input.kitKey) : undefined;
    const offer = kit ? offerOf(kit) : null;
    if (input.kitKey && !offer) issues.push({ field: "kitKey", message: "kit inexistente ou sem preço vigente" });
    if (issues.length > 0) return { ok: false, issues };

    const quote = offer ? quoteKit(offer, input.modules, prices) : quoteMonthly(input.modules, prices);
    for (const key of quote.modules) {
      if (catalog.get(key)?.status !== "AVAILABLE") issues.push({ field: "modules", message: `módulo indisponível: ${key}` });
    }
    if (quote.unpriced.length > 0) {
      issues.push({ field: "modules", message: `módulo sem preço vigente: ${quote.unpriced.join(", ")}` });
    }
    return issues.length > 0 ? { ok: false, issues } : { ok: true, offer, quote };
  };

  const summarize = async (
    companyId: string,
    stored: StoredSubscription | null,
    at: Date,
  ): Promise<SubscriptionSummary> => {
    const [{ modules, kits, prices }, activeKeys] = await Promise.all([
      loadCatalog(at),
      deps.repository.listActiveModules(companyId),
    ]);
    const names = new Map(modules.map((entry) => [entry.key, entry.name]));
    const active = activeKeys.map((key) => ({ key, name: names.get(key) ?? key }));

    if (!stored) {
      return {
        status: "NOT_STARTED",
        hasAccess: true,
        canChangeModules: false,
        trial: null,
        kit: null,
        modules: active,
        monthlyTotalCents: null,
        currency: "BRL",
        dataRetentionUntil: null,
      };
    }

    const status = effectiveStatus(stored, at);
    const kit = stored.kitKey ? (kits.find((candidate) => candidate.key === stored.kitKey) ?? null) : null;
    const offer = kit ? offerOf(kit) : null;

    let monthlyTotalCents: number | null = null;
    // Kit gravado mas sem preço vigente: o valor fica indefinido em vez de errado.
    if (!stored.kitKey || offer) {
      const quote = offer ? quoteKit(offer, activeKeys, prices) : quoteMonthly(activeKeys, prices);
      monthlyTotalCents = quote.unpriced.length > 0 ? null : quote.totalCents;
    }

    return {
      status,
      hasAccess: grantsAccess(status),
      canChangeModules: canChangeModules(status),
      trial:
        stored.status === "TRIALING" && stored.trialEndsAt
          ? {
              startedAt: stored.trialStartedAt,
              endsAt: stored.trialEndsAt,
              daysRemaining: trialDaysRemaining(stored.trialEndsAt, at) ?? 0,
            }
          : null,
      kit: kit ? { key: kit.key, name: kit.name } : null,
      modules: active,
      monthlyTotalCents,
      currency: "BRL",
      dataRetentionUntil: dataRetentionUntil(stored),
    };
  };

  return {
    async getSummary(context: AuthorizedContext): Promise<SubscriptionSummary> {
      return summarize(context.companyId, await deps.repository.findByCompany(context.companyId), deps.now());
    },

    async startTrial(context: AuthorizedContext, rawInput: unknown, request: RequestContext): Promise<StartTrialResult> {
      const input = moduleSelectionInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      if (await deps.repository.findByCompany(context.companyId)) {
        return { ok: false, reason: "trial_already_started" };
      }

      const at = deps.now();
      const selection = await validateSelection(input.data, at);
      if (!selection.ok) return invalid(selection.issues);

      let created: { readonly id: string };
      try {
        created = await deps.repository.startTrial({
          companyId: context.companyId,
          kitKey: selection.offer?.key ?? null,
          modules: selection.quote.modules,
          startedAt: at,
          endsAt: trialEndFrom(at),
        });
      } catch (error) {
        // Duas requisições ao mesmo tempo: a unicidade no banco decide.
        if (error instanceof TrialAlreadyStartedError) return { ok: false, reason: "trial_already_started" };
        throw error;
      }

      await deps.audit.record({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: SUBSCRIPTION_AUDIT_ACTIONS.trialStarted,
        entityType: "Subscription",
        entityId: created.id,
        metadata: {
          kitKey: selection.offer?.key ?? null,
          modules: selection.quote.modules.join(","),
          monthlyTotalCents: selection.quote.totalCents,
          trialDays: TRIAL_DAYS,
        },
        ...auditContext(request),
      });

      return {
        ok: true,
        subscription: await summarize(context.companyId, await deps.repository.findByCompany(context.companyId), at),
      };
    },

    /**
     * Troca kit e módulos durante o teste grátis vigente (MASTER SPEC 2.8): o
     * valor após o trial passa a refletir a nova escolha; as datas do trial não
     * mudam. Módulo que sai é desativado, sem apagar dados (MASTER SPEC 17.2).
     */
    async changeModules(
      context: AuthorizedContext,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<ChangeModulesResult> {
      const input = moduleSelectionInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const at = deps.now();
      const stored = await deps.repository.findByCompany(context.companyId);
      if (!stored) return { ok: false, reason: "trial_not_started" };
      if (!canChangeModules(effectiveStatus(stored, at))) return { ok: false, reason: "not_in_trial" };

      const selection = await validateSelection(input.data, at);
      if (!selection.ok) return invalid(selection.issues);

      const kitKey = selection.offer?.key ?? null;
      let change: { readonly activated: string[]; readonly deactivated: string[] };
      try {
        change = await deps.repository.changeModules({
          companyId: context.companyId,
          kitKey,
          modules: selection.quote.modules,
          at,
        });
      } catch (error) {
        // O trial venceu entre a leitura e a gravação.
        if (error instanceof SubscriptionNotInTrialError) return { ok: false, reason: "not_in_trial" };
        throw error;
      }

      if (kitKey !== stored.kitKey || change.activated.length > 0 || change.deactivated.length > 0) {
        await deps.audit.record({
          companyId: context.companyId,
          actorUserId: context.userId,
          action: SUBSCRIPTION_AUDIT_ACTIONS.modulesChanged,
          entityType: "Subscription",
          entityId: stored.id,
          metadata: {
            kitKey,
            previousKitKey: stored.kitKey,
            activated: change.activated.join(","),
            deactivated: change.deactivated.join(","),
            monthlyTotalCents: selection.quote.totalCents,
          },
          ...auditContext(request),
        });
      }

      return {
        ok: true,
        subscription: await summarize(context.companyId, await deps.repository.findByCompany(context.companyId), at),
      };
    },
  };
}

export type SubscriptionUseCases = ReturnType<typeof createSubscriptionUseCases>;
