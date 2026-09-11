"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/presentation/api-client";
import { Alert, BrandLogo, Button } from "@/presentation/components/ui";
import { formatBRL, formatDate, pluralizeDays } from "@/presentation/format";
import { LogoutButton } from "./logout-button";

interface CatalogModule {
  readonly key: string;
  readonly name: string;
  readonly benefit: string;
  readonly isCore: boolean;
  readonly status: "AVAILABLE" | "COMING_SOON" | "RETIRED";
  readonly monthlyPriceCents: number | null;
}

interface CatalogKit {
  readonly key: string;
  readonly name: string;
  readonly audience: string;
  readonly modules: readonly string[];
  readonly monthlyPriceCents: number | null;
}

export interface Catalog {
  readonly modules: readonly CatalogModule[];
  readonly kits: readonly CatalogKit[];
  readonly trialDays: number;
}

interface Quote {
  readonly totalCents: number;
  readonly suggestion?: { readonly kitKey: string; readonly totalCents: number; readonly savingsCents: number } | null;
}

export interface Subscription {
  readonly status: string;
  readonly hasAccess: boolean;
  readonly trial: { readonly startedAt: string | null; readonly endsAt: string; readonly daysRemaining: number } | null;
  readonly kit: { readonly key: string; readonly name: string } | null;
  readonly modules: ReadonlyArray<{ readonly key: string; readonly name: string }>;
  readonly monthlyTotalCents: number | null;
  readonly dataRetentionUntil: string | null;
}

/** Dados carregados no servidor pela página. */
export interface BuilderData {
  readonly catalog: Catalog;
  readonly subscription: Subscription;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  TRIAL_ACTIVE: "Em teste grátis",
  TRIAL_EXPIRING: "Teste grátis terminando",
  TRIAL_EXPIRED: "Teste grátis encerrado",
  ACTIVE: "Assinatura ativa",
  REACTIVATED: "Assinatura reativada",
  PAYMENT_PENDING: "Pagamento em processamento",
  PAST_DUE: "Pagamento em atraso",
  CANCELED: "Assinatura cancelada",
  SUSPENDED: "Assinatura suspensa",
};

const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

/** Builder (MASTER SPEC 2.4): preços e total vêm sempre do servidor. `data` nulo: perfil sem permissão. */
export function BuilderClient({
  userName,
  companyName,
  data,
}: {
  readonly userName: string;
  readonly companyName: string;
  readonly data: BuilderData | null;
}) {
  const [subscription, setSubscription] = useState<Subscription | null>(data?.subscription ?? null);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <BrandLogo className="w-28" />
            <span className="hidden text-sm text-slate-500 sm:inline">{companyName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-400">{userName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!data || !subscription ? (
          <Alert tone="info">Somente Proprietário ou Administrador podem escolher os módulos da empresa.</Alert>
        ) : subscription.status === "NOT_STARTED" ? (
          <ModulePicker catalog={data.catalog} onStarted={setSubscription} />
        ) : (
          <SubscriptionSummary subscription={subscription} />
        )}
      </main>
    </div>
  );
}

function ModulePicker({
  catalog,
  onStarted,
}: {
  readonly catalog: Catalog;
  readonly onStarted: (subscription: Subscription) => void;
}) {
  const [kitKey, setKitKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kit = catalog.kits.find((entry) => entry.key === kitKey) ?? null;
  const inKit = useMemo(() => new Set(kit?.modules ?? []), [kit]);
  const byKey = useMemo(() => new Map(catalog.modules.map((entry) => [entry.key, entry])), [catalog.modules]);
  const extras = useMemo(
    () =>
      catalog.modules
        .filter((entry) => !entry.isCore && selected.has(entry.key) && !inKit.has(entry.key))
        .map((entry) => entry.key),
    [catalog.modules, selected, inKit],
  );
  const extrasParam = extras.join(",");

  // Preço em tempo real: o total é recalculado no servidor a cada mudança.
  useEffect(() => {
    const params = new URLSearchParams();
    if (kitKey) params.set("kit", kitKey);
    if (extrasParam) params.set("modules", extrasParam);

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await api<{ quote: Quote }>(`/api/builder/quote?${params.toString()}`);
      if (!cancelled && result.ok) setQuote(result.data.quote);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kitKey, extrasParam]);

  const toggleModule = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const start = async () => {
    setSubmitting(true);
    setError(null);
    const result = await api<{ subscription: Subscription }>("/api/builder/trial", {
      method: "POST",
      body: { kitKey, modules: extras },
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(errorMessage(result.error, "Não foi possível iniciar o teste grátis."));
      return;
    }
    onStarted(result.data.subscription);
  };

  const suggestion = kitKey ? null : (quote?.suggestion ?? null);
  const suggestedKit = suggestion ? catalog.kits.find((entry) => entry.key === suggestion.kitKey) : undefined;
  const price = (cents: number | null) => (cents === null ? "—" : `${formatBRL(cents)}/mês`);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-10">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight">Monte o VELDOCS da sua empresa</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Escolha um kit, módulos avulsos ou os dois. Você testa tudo grátis por {catalog.trialDays} dias.
          </p>
        </section>

        <section aria-labelledby="kits-title">
          <h2 id="kits-title" className="text-lg font-semibold">
            Kits
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.kits.map((entry) => {
              const active = entry.key === kitKey;
              return (
                <button
                  key={entry.key}
                  type="button"
                  data-testid={`kit-${entry.key}`}
                  aria-pressed={active}
                  onClick={() => setKitKey((current) => (current === entry.key ? null : entry.key))}
                  className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-brand-primary ${
                    active
                      ? "border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{entry.name}</span>
                    <span className="text-sm font-medium">{price(entry.monthlyPriceCents)}</span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{entry.audience}</span>
                  <span className="mt-2 block text-xs text-slate-500">
                    {entry.modules
                      .filter((key) => !byKey.get(key)?.isCore)
                      .map((key) => byKey.get(key)?.name ?? key)
                      .join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="modules-title">
          <h2 id="modules-title" className="text-lg font-semibold">
            Módulos
          </h2>
          <ul className={`mt-4 divide-y divide-slate-200 dark:divide-slate-800 ${CARD}`}>
            {catalog.modules.map((entry) => {
              const included = entry.isCore || inKit.has(entry.key);
              const unavailable = entry.status !== "AVAILABLE";
              const note = entry.isCore
                ? "Obrigatório"
                : inKit.has(entry.key)
                  ? "Incluído no kit"
                  : unavailable
                    ? "Em breve"
                    : null;
              return (
                <li key={entry.key} className="flex items-start gap-3 p-4">
                  <input
                    id={`module-${entry.key}`}
                    type="checkbox"
                    className="mt-1 size-4 accent-brand-primary"
                    checked={included || selected.has(entry.key)}
                    disabled={included || unavailable}
                    onChange={() => toggleModule(entry.key)}
                  />
                  <label
                    htmlFor={`module-${entry.key}`}
                    className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                  >
                    <span>
                      <span className="font-medium">{entry.name}</span>
                      <span className="block text-sm text-slate-600 dark:text-slate-400">{entry.benefit}</span>
                    </span>
                    <span className="text-sm">
                      {note ? <span className="text-slate-500">{note}</span> : price(entry.monthlyPriceCents)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className={`p-6 ${CARD}`}>
          <h2 className="text-lg font-semibold">Resumo</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {kit ? (
              <div className="flex justify-between gap-4">
                <dt>Kit {kit.name}</dt>
                <dd>{price(kit.monthlyPriceCents)}</dd>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <dt>Core</dt>
                <dd>{price(catalog.modules.find((entry) => entry.isCore)?.monthlyPriceCents ?? null)}</dd>
              </div>
            )}
            {extras.map((key) => (
              <div key={key} className="flex justify-between gap-4">
                <dt>{byKey.get(key)?.name ?? key}</dt>
                <dd>{price(byKey.get(key)?.monthlyPriceCents ?? null)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">Depois do teste grátis</p>
            <p className="text-3xl font-semibold" data-testid="builder-total">
              {quote ? formatBRL(quote.totalCents) : "—"}
              <span className="text-base font-normal text-slate-500">/mês</span>
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {catalog.trialDays} dias grátis. Nada é cobrado agora.
            </p>
          </div>

          {suggestion && suggestedKit ? (
            <div data-testid="builder-suggestion" className="mt-4 rounded-xl bg-brand-primary/10 p-4 text-sm">
              <p>
                Com o kit <strong>{suggestedKit.name}</strong> a mesma escolha sai por {formatBRL(suggestion.totalCents)}
                /mês — economia de {formatBRL(suggestion.savingsCents)}.
              </p>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setKitKey(suggestion.kitKey)}>
                Usar o kit {suggestedKit.name}
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <Button className="mt-6 w-full" loading={submitting} onClick={start}>
            Começar {catalog.trialDays} dias grátis
          </Button>
        </div>
      </aside>
    </div>
  );
}

function SubscriptionSummary({ subscription }: { readonly subscription: Subscription }) {
  return (
    <section data-testid="subscription-summary" className={`mx-auto max-w-2xl p-8 ${CARD}`}>
      <p className="text-sm font-medium text-brand-primary dark:text-brand-cyan">
        {STATUS_LABELS[subscription.status] ?? subscription.status}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {subscription.kit ? `Kit ${subscription.kit.name}` : "Seus módulos"}
      </h1>
      {subscription.trial ? (
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {pluralizeDays(subscription.trial.daysRemaining)} — até {formatDate(subscription.trial.endsAt)}
        </p>
      ) : null}

      {!subscription.hasAccess ? (
        <div className="mt-4">
          <Alert>
            O acesso da empresa está bloqueado. Seus dados continuam guardados
            {subscription.dataRetentionUntil ? ` até ${formatDate(subscription.dataRetentionUntil)}` : ""}.
          </Alert>
        </div>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Módulos ativos</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {subscription.modules.map((entry) => (
          <li key={entry.key} className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">
            {entry.name}
          </li>
        ))}
      </ul>

      {subscription.monthlyTotalCents !== null ? (
        <p className="mt-8 text-slate-600 dark:text-slate-400">
          Depois do teste grátis:{" "}
          <strong className="text-slate-900 dark:text-white">{formatBRL(subscription.monthlyTotalCents)}/mês</strong>
        </p>
      ) : null}
    </section>
  );
}
