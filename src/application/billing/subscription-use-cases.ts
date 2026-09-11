import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { BillingCatalogRepository, CatalogKit } from "@/application/ports/billing-catalog";
import {
  type StoredSubscription,
  type SubscriptionRepository,
  TrialAlreadyStartedError,
} from "@/application/ports/subscription-repository";
import { MODULE_KEYS } from "@/domain/billing/module-catalog";
import { type KitOffer, quoteKit, quoteMonthly } from "@/domain/billing/pricing";
import {
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
} as const;

/** Chave opcional: ausente, nula ou vazia viram `null`. */
const optionalKey = z
  .union([z.literal("").transform(() => null), z.string().trim().min(1).max(60)])
  .nullish()
  .transform((value) => value ?? null);

export const startTrialInputSchema = z.object({
  kitKey: optionalKey,
  modules: z.array(z.string().trim().min(1).max(60)).max(MODULE_KEYS.length).default([]),
});

export interface SubscriptionSummary {
  /** `NOT_STARTED`: a empresa ainda não passou pelo Builder. */
  readonly status: "NOT_STARTED" | EffectiveStatus;
  /** A empresa consegue usar o sistema (DEC-022). */
  readonly hasAccess: boolean;
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

export type StartTrialResult =
  | { readonly ok: true; readonly subscription: SubscriptionSummary }
  | { readonly ok: false; readonly reason: "invalid_input"; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly reason: "trial_already_started" };

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const offerOf = (kit: CatalogKit): KitOffer | null =>
  kit.monthlyPriceCents === null ? null : { key: kit.key, modules: kit.modules, priceCents: kit.monthlyPriceCents };

/**
 * Builder (MASTER SPEC 2.4 e 2.8): situação da assinatura e início do trial
 * de 14 dias. A empresa vem sempre do `AuthorizedContext`; preços e
 * disponibilidade vêm sempre do catálogo no servidor.
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
      const input = startTrialInputSchema.safeParse(rawInput);
      if (!input.success) return { ok: false, reason: "invalid_input", issues: issuesOf(input.error) };

      if (await deps.repository.findByCompany(context.companyId)) {
        return { ok: false, reason: "trial_already_started" };
      }

      const at = deps.now();
      const { modules, kits, prices } = await loadCatalog(at);
      const catalog = new Map(modules.map((entry) => [entry.key, entry]));
      const issues: ValidationIssue[] = [];

      for (const key of new Set(input.data.modules)) {
        if (!catalog.has(key)) issues.push({ field: "modules", message: `módulo inexistente: ${key}` });
      }
      const kit = input.data.kitKey ? kits.find((candidate) => candidate.key === input.data.kitKey) : undefined;
      const offer = kit ? offerOf(kit) : null;
      if (input.data.kitKey && !offer) issues.push({ field: "kitKey", message: "kit inexistente ou sem preço vigente" });
      if (issues.length > 0) return { ok: false, reason: "invalid_input", issues };

      const quote = offer ? quoteKit(offer, input.data.modules, prices) : quoteMonthly(input.data.modules, prices);
      for (const key of quote.modules) {
        if (catalog.get(key)?.status !== "AVAILABLE") issues.push({ field: "modules", message: `módulo indisponível: ${key}` });
      }
      if (quote.unpriced.length > 0) {
        issues.push({ field: "modules", message: `módulo sem preço vigente: ${quote.unpriced.join(", ")}` });
      }
      if (issues.length > 0) return { ok: false, reason: "invalid_input", issues };

      let created: { readonly id: string };
      try {
        created = await deps.repository.startTrial({
          companyId: context.companyId,
          kitKey: offer?.key ?? null,
          modules: quote.modules,
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
          kitKey: offer?.key ?? null,
          modules: quote.modules.join(","),
          monthlyTotalCents: quote.totalCents,
          trialDays: TRIAL_DAYS,
        },
        ...auditContext(request),
      });

      return {
        ok: true,
        subscription: await summarize(context.companyId, await deps.repository.findByCompany(context.companyId), at),
      };
    },
  };
}

export type SubscriptionUseCases = ReturnType<typeof createSubscriptionUseCases>;
