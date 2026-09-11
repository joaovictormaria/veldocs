import Link from "next/link";
import { activityLabel, timeAgo } from "@/presentation/activity";
import { CARD } from "@/presentation/components/ui";
import { EXPIRATION_LABELS, expirationPhrase } from "@/presentation/documents";
import { formatCalendarDate } from "@/presentation/format";

export interface DashboardData {
  readonly userName: string;
  readonly companyName: string;
  /** Momento da renderização (ISO), para "há 5 min". */
  readonly now: string;
  readonly today: string;
  readonly documents: {
    readonly total: number;
    readonly withoutCategory: number;
    readonly withoutResponsible: number;
    readonly withoutExpiration: number;
    readonly createdLast30Days: number;
  };
  readonly categories: {
    readonly items: ReadonlyArray<{ readonly categoryId: string | null; readonly name: string | null; readonly count: number }>;
    readonly others: number;
  };
  readonly expirations: {
    readonly windowDays: number;
    readonly counts: { readonly valid: number; readonly expiring: number; readonly expired: number; readonly withoutExpiration: number };
    readonly upcoming: ReadonlyArray<{
      readonly id: string;
      readonly title: string;
      readonly expirationDate: string | null;
      readonly expirationStatus: string;
      readonly daysRemaining: number;
    }>;
  } | null;
  readonly activity: ReadonlyArray<{
    readonly id: string;
    readonly action: string;
    readonly actorName: string | null;
    readonly entityName: string | null;
    readonly createdAt: string;
  }> | null;
}

const MUTED = "text-slate-600 dark:text-slate-400";
const SECTION_TITLE = "text-sm font-semibold uppercase tracking-wide text-slate-500";

/** Números de situação: cor de status com rótulo ao lado (nunca só a cor). */
const STATUS_TONES = {
  EXPIRED: "text-red-700 dark:text-red-300",
  EXPIRING: "text-amber-700 dark:text-amber-300",
  VALID: "text-emerald-700 dark:text-emerald-300",
  NO_EXPIRATION: "text-slate-700 dark:text-slate-300",
} as const;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Painel da empresa (MASTER SPEC 11.1). Componente de servidor: só leitura e
 * links, sem estado — cada número leva à lista correspondente.
 */
export function DashboardView({ data }: { readonly data: DashboardData }) {
  const firstName = data.userName.split(" ")[0] ?? data.userName;
  const now = new Date(data.now);
  const withExpiration = data.documents.total - data.documents.withoutExpiration;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Olá, {firstName}</h1>
          <p className={`mt-1 ${MUTED}`}>
            Panorama de {data.companyName} em {formatCalendarDate(data.today)}.
          </p>
        </div>
        <Link
          href="/documentos"
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          Ir para documentos
        </Link>
      </div>

      {data.documents.total === 0 ? (
        <section className={`p-8 text-center ${CARD}`}>
          <h2 className="text-xl font-semibold">Nenhum documento cadastrado ainda</h2>
          <p className={`mt-2 ${MUTED}`}>
            Cadastre os documentos da empresa com responsável e validade — o painel se monta sozinho a partir deles.
          </p>
          <Link href="/documentos" className="mt-4 inline-block font-medium text-brand-dark hover:underline dark:text-brand-cyan">
            Cadastrar o primeiro documento
          </Link>
        </section>
      ) : null}

      <section aria-label="Cadastro documental" data-testid="indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          value={data.documents.total}
          label="Documentos"
          detail={`${plural(data.documents.createdLast30Days, "novo", "novos")} nos últimos 30 dias`}
        />
        <Tile value={data.documents.withoutResponsible} label="Sem responsável" detail="ninguém cuidando deles" />
        <Tile value={data.documents.withoutExpiration} label="Sem validade" detail="não entram nos vencimentos" />
        <Tile value={data.documents.withoutCategory} label="Sem categoria" detail="mais difíceis de encontrar" />
      </section>

      {data.expirations ? (
        <ExpirationsBlock expirations={data.expirations} />
      ) : withExpiration > 0 ? (
        <section data-testid="oferta-vencimentos" className={`flex flex-wrap items-center justify-between gap-4 p-6 ${CARD}`}>
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand-dark dark:text-brand-cyan">Controle de vencimentos</p>
            <p className="mt-1">
              Você tem {plural(withExpiration, "documento", "documentos")} com validade cadastrada. O módulo mostra o que
              está vencendo e ajuda a renovar a tempo.
            </p>
          </div>
          <Link href="/vencimentos" className="font-medium text-brand-dark hover:underline dark:text-brand-cyan">
            Conhecer o módulo
          </Link>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryChart categories={data.categories} />
        {data.activity ? <RecentActivity activity={data.activity} now={now} /> : null}
      </div>
    </div>
  );
}

function Tile({ value, label, detail }: { readonly value: number; readonly label: string; readonly detail: string }) {
  return (
    <div className={`p-5 ${CARD}`}>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 font-medium">{label}</p>
      <p className={`text-sm ${MUTED}`}>{detail}</p>
    </div>
  );
}

function ExpirationsBlock({ expirations }: { readonly expirations: NonNullable<DashboardData["expirations"]> }) {
  const tiles = [
    { status: "EXPIRED", value: expirations.counts.expired, label: "Vencidos" },
    { status: "EXPIRING", value: expirations.counts.expiring, label: `Vencem em até ${expirations.windowDays} dias` },
    { status: "VALID", value: expirations.counts.valid, label: "Em dia" },
    { status: "NO_EXPIRATION", value: expirations.counts.withoutExpiration, label: "Sem validade" },
  ] as const;

  return (
    <section aria-labelledby="titulo-vencimentos" data-testid="bloco-vencimentos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-vencimentos" className={SECTION_TITLE}>
          Vencimentos
        </h2>
        <Link href="/vencimentos" className="text-sm font-medium text-brand-dark hover:underline dark:text-brand-cyan">
          Abrir painel de vencimentos
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.status}
              href={`/documentos?status=${tile.status}`}
              className={`p-5 transition hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary ${CARD}`}
            >
              <p className={`text-3xl font-semibold tabular-nums ${STATUS_TONES[tile.status]}`}>{tile.value}</p>
              <p className={`mt-1 text-sm ${MUTED}`}>{tile.label}</p>
            </Link>
          ))}
        </div>

        <div className={CARD}>
          <h3 className="border-b border-slate-200 px-5 py-3 font-medium dark:border-slate-800">Próximos vencimentos</h3>
          {expirations.upcoming.length === 0 ? (
            <p className={`px-5 py-8 text-center ${MUTED}`}>Nada vencido nem vencendo nos próximos {expirations.windowDays} dias.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {expirations.upcoming.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{item.title}</span>
                  <span className={`shrink-0 ${STATUS_TONES[item.expirationStatus as keyof typeof STATUS_TONES] ?? ""}`}>
                    {EXPIRATION_LABELS[item.expirationStatus]} · {expirationPhrase(item.daysRemaining)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Barras horizontais de uma série só: uma cor (azul da marca, validada nos
 * dois temas), sem legenda — o título diz o que é —, valor na ponta em tinta
 * de texto, barra de no máximo 12 px com a ponta arredondada e a base reta.
 */
function CategoryChart({ categories }: { readonly categories: DashboardData["categories"] }) {
  const rows = [
    ...categories.items.map((item) => ({
      key: item.categoryId ?? "sem-categoria",
      name: item.categoryId === null ? "Sem categoria" : (item.name ?? "Categoria excluída"),
      count: item.count,
      href: item.categoryId ? `/documentos?categoryId=${item.categoryId}` : null,
    })),
    ...(categories.others > 0
      ? [{ key: "outras", name: "Outras categorias", count: categories.others, href: null }]
      : []),
  ];
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section aria-labelledby="titulo-categorias" data-testid="grafico-categorias" className={`p-5 ${CARD}`}>
      <h2 id="titulo-categorias" className={SECTION_TITLE}>
        Documentos por categoria
      </h2>

      {rows.length === 0 ? (
        <p className={`mt-6 text-center ${MUTED}`}>Os documentos aparecem aqui conforme forem cadastrados.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const label = `${row.name}: ${plural(row.count, "documento", "documentos")}`;
            const content = (
              <>
                <span className="block truncate text-sm">{row.name}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="block h-3 rounded-r bg-brand-primary"
                    style={{ width: `max(2px, ${(row.count / max) * 85}%)` }}
                  />
                  <span className="text-sm font-medium tabular-nums">{row.count}</span>
                </span>
              </>
            );

            return (
              <li key={row.key} title={label}>
                {row.href ? (
                  <Link href={row.href} aria-label={label} className="block rounded-md p-1 -m-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                    {content}
                  </Link>
                ) : (
                  <div aria-label={label} className="p-1 -m-1">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({ activity, now }: { readonly activity: NonNullable<DashboardData["activity"]>; readonly now: Date }) {
  return (
    <section aria-labelledby="titulo-atividade" data-testid="atividade" className={`p-5 ${CARD}`}>
      <h2 id="titulo-atividade" className={SECTION_TITLE}>
        Atividade recente
      </h2>

      {activity.length === 0 ? (
        <p className={`mt-6 text-center ${MUTED}`}>Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {activity.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{event.actorName ?? "Alguém"}</span> {activityLabel(event.action)}
                {event.entityName ? <span className="font-medium"> “{event.entityName}”</span> : null}
              </span>
              <time dateTime={event.createdAt} className={`shrink-0 ${MUTED}`}>
                {timeAgo(event.createdAt, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
