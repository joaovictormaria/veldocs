"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorMessage, fieldErrors } from "@/presentation/api-client";
import { Alert, Button, CARD, Field } from "@/presentation/components/ui";
import { EXPIRATION_CHIPS, EXPIRATION_LABELS, expirationPhrase } from "@/presentation/documents";
import { formatCalendarDate } from "@/presentation/format";

export interface ExpiringItem {
  readonly id: string;
  readonly title: string;
  readonly expirationDate: string | null;
  readonly issueDate: string | null;
  readonly expirationStatus: string;
  readonly daysRemaining: number;
  readonly category: { readonly id: string; readonly name: string } | null;
  readonly responsible: { readonly userId: string; readonly name: string } | null;
}

export interface ExpirationsData {
  readonly today: string;
  readonly windowDays: number;
  readonly counts: {
    readonly valid: number;
    readonly expiring: number;
    readonly expired: number;
    readonly withoutExpiration: number;
    readonly total: number;
  };
  readonly upcoming: readonly ExpiringItem[];
  readonly can: { readonly renew: boolean };
}

/** Por que a tela não tem dados: módulo não contratado ou perfil sem permissão. */
export type ExpirationsBlock = "module_not_enabled" | "forbidden";

const COUNTER_TONES = {
  expired: "text-red-700 dark:text-red-300",
  expiring: "text-amber-700 dark:text-amber-300",
  valid: "text-emerald-700 dark:text-emerald-300",
  withoutExpiration: "text-slate-600 dark:text-slate-300",
} as const;

/** Controle de vencimentos (MASTER SPEC 10.2): capacidade do módulo pago. */
export function ExpirationsClient({
  data,
  block,
}: {
  readonly data: ExpirationsData | null;
  readonly block?: ExpirationsBlock;
}) {
  if (!data) {
    return block === "module_not_enabled" ? <ModuleOffer /> : (
      <Alert tone="info">Seu perfil não tem permissão para ver os vencimentos desta empresa.</Alert>
    );
  }
  return <ExpirationPanel data={data} />;
}

function ModuleOffer() {
  return (
    <section className={`mx-auto max-w-2xl p-8 ${CARD}`}>
      <p className="text-sm font-medium text-brand-primary dark:text-brand-cyan">Controle de vencimentos</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Nenhum documento vence sem aviso</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Este módulo acompanha a validade dos documentos: mostra o que está vencido, o que vence nos próximos dias e
        permite renovar sem perder o histórico. Ele não está no plano da sua empresa.
      </p>
      <Link
        href="/builder"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        Ver módulos e preços
      </Link>
    </section>
  );
}

function ExpirationPanel({ data }: { readonly data: ExpirationsData }) {
  const [summary, setSummary] = useState(data);
  const [renewing, setRenewing] = useState<ExpiringItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const result = await api<Omit<ExpirationsData, "can">>("/api/expirations");
    if (result.ok) setSummary((current) => ({ ...result.data, can: current.can }));
    else setError(errorMessage(result.error, "Não foi possível atualizar o painel."));
  };

  const counters = [
    { key: "expired", label: "Vencidos", value: summary.counts.expired },
    { key: "expiring", label: `Vencem em até ${summary.windowDays} dias`, value: summary.counts.expiring },
    { key: "valid", label: "Em dia", value: summary.counts.valid },
    { key: "withoutExpiration", label: "Sem validade", value: summary.counts.withoutExpiration },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vencimentos</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Situação de {summary.counts.total} {summary.counts.total === 1 ? "documento" : "documentos"} em{" "}
          {formatCalendarDate(summary.today)}.
        </p>
      </div>

      <section aria-label="Resumo" data-testid="resumo-vencimentos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counters.map((counter) => (
          <div key={counter.key} className={`p-5 ${CARD}`}>
            <p className={`text-3xl font-semibold ${COUNTER_TONES[counter.key]}`}>{counter.value}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{counter.label}</p>
          </div>
        ))}
      </section>

      {error ? <Alert>{error}</Alert> : null}

      <section aria-label="Documentos que precisam de atenção" className={CARD}>
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
          Precisam de atenção
        </h2>

        {summary.upcoming.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-600 dark:text-slate-400">
            Nada vencido nem vencendo nos próximos {summary.windowDays} dias.
          </p>
        ) : (
          <ul data-testid="lista-vencimentos" className="divide-y divide-slate-200 dark:divide-slate-800">
            {summary.upcoming.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {item.category ? `${item.category.name} · ` : ""}
                    {item.responsible ? item.responsible.name : "Sem responsável"}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      EXPIRATION_CHIPS[item.expirationStatus] ?? EXPIRATION_CHIPS.NO_EXPIRATION
                    }`}
                  >
                    {EXPIRATION_LABELS[item.expirationStatus] ?? item.expirationStatus}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {item.expirationDate ? formatCalendarDate(item.expirationDate) : "—"} ·{" "}
                    {expirationPhrase(item.daysRemaining)}
                  </span>
                  {summary.can.renew ? (
                    <Button variant="secondary" onClick={() => setRenewing(item)}>
                      Renovar
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {renewing ? (
        <RenewalForm
          document={renewing}
          onClose={() => setRenewing(null)}
          onDone={async () => {
            setRenewing(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function RenewalForm({
  document,
  onClose,
  onDone,
}: {
  readonly document: ExpiringItem;
  readonly onClose: () => void;
  readonly onDone: () => void;
}) {
  const [issueDate, setIssueDate] = useState(document.issueDate ?? "");
  const [expirationDate, setExpirationDate] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setIssues({});

    const result = await api(`/api/documents/${document.id}/renew`, {
      method: "POST",
      body: { issueDate, expirationDate },
    });
    setSaving(false);

    if (!result.ok) {
      setIssues(fieldErrors(result.error));
      setError(errorMessage(result.error, "Não foi possível renovar o documento."));
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-renovacao"
        data-testid="form-renovacao"
        className={`w-full max-w-lg p-6 ${CARD}`}
      >
        <h2 id="titulo-renovacao" className="text-xl font-semibold tracking-tight">
          Renovar documento
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {document.title}
          {document.expirationDate ? ` — validade atual: ${formatCalendarDate(document.expirationDate)}` : ""}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            id="renovacao-emissao"
            label="Nova emissão"
            type="date"
            value={issueDate}
            error={issues.issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
          <Field
            id="renovacao-validade"
            label="Nova validade"
            type="date"
            autoFocus
            value={expirationDate}
            error={issues.expirationDate}
            onChange={(event) => setExpirationDate(event.target.value)}
          />
        </div>

        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button loading={saving} onClick={submit}>
            Salvar renovação
          </Button>
        </div>
      </div>
    </div>
  );
}
