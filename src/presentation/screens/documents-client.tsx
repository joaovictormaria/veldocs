"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, fieldErrors } from "@/presentation/api-client";
import { Alert, Button, CARD, Field } from "@/presentation/components/ui";
import { type DocumentFilters, documentsQuery, EMPTY_FILTERS, formatTagsInput, pageSummary, parseTagsInput } from "@/presentation/documents";
import { formatCalendarDate } from "@/presentation/format";

export interface DocumentItem {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly category: { readonly id: string; readonly name: string } | null;
  readonly branch: { readonly id: string; readonly name: string } | null;
  readonly department: { readonly id: string; readonly name: string } | null;
  readonly responsible: { readonly userId: string; readonly name: string } | null;
  readonly issueDate: string | null;
  readonly expirationDate: string | null;
  readonly tags: readonly string[];
}

export interface DocumentListing {
  readonly items: readonly DocumentItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface CategoryOption {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
}

export interface DocumentsData {
  readonly listing: DocumentListing;
  readonly categories: readonly CategoryOption[];
  readonly branches: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly departments: ReadonlyArray<{ readonly id: string; readonly name: string; readonly branchId: string | null }>;
  /** Vazio quando o perfil não pode ver os membros: o campo some do formulário. */
  readonly members: ReadonlyArray<{ readonly userId: string; readonly name: string }>;
  readonly tags: ReadonlyArray<{ readonly name: string; readonly documentCount: number }>;
  readonly can: { readonly create: boolean; readonly update: boolean; readonly remove: boolean };
}

const SELECT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 dark:border-slate-700 dark:bg-slate-950";

const CHIP = "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300";
/** Categoria em azul da marca: azul escuro no claro, ciano no escuro (regra da paleta). */
const CATEGORY_CHIP =
  "rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark dark:bg-brand-primary/20 dark:text-brand-cyan";

const categoryLabel = (category: CategoryOption) => category.path.join(" › ");

/** Documentos da empresa (MASTER SPEC 10.1). `data` nulo: perfil sem permissão de leitura. */
export function DocumentsClient({ data }: { readonly data: DocumentsData | null }) {
  if (!data) {
    return <Alert tone="info">Seu perfil não tem permissão para ver os documentos desta empresa.</Alert>;
  }
  return <DocumentsBrowser data={data} />;
}

function DocumentsBrowser({ data }: { readonly data: DocumentsData }) {
  const [filters, setFilters] = useState<DocumentFilters>(EMPTY_FILTERS);
  const [listing, setListing] = useState(data.listing);
  const [tags, setTags] = useState(data.tags);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentItem | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const query = documentsQuery(filters);
  // A primeira lista veio do servidor: só busca de novo quando algo muda.
  const firstRender = useRef(true);

  const load = async (search: string) => {
    const [documents, updatedTags] = await Promise.all([
      api<DocumentListing>(`/api/documents?${search}`),
      api<{ tags: DocumentsData["tags"] }>("/api/tags"),
    ]);
    if (documents.ok) setListing(documents.data);
    else setError(errorMessage(documents.error, "Não foi possível carregar os documentos."));
    if (updatedTags.ok) setTags(updatedTags.data.tags);
    return documents.ok;
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const result = await api<DocumentListing>(`/api/documents?${query}`);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setListing(result.data);
      else setError(errorMessage(result.error, "Não foi possível carregar os documentos."));
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const update = (changes: Partial<DocumentFilters>) =>
    // Qualquer filtro novo volta para a primeira página.
    setFilters((current) => ({ ...current, page: 1, ...changes }));

  const remove = async (document: DocumentItem) => {
    setConfirming(null);
    const result = await api(`/api/documents/${document.id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(errorMessage(result.error, "Não foi possível excluir o documento."));
      return;
    }
    await load(query);
  };

  const lastPage = Math.max(1, Math.ceil(listing.total / listing.pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documentos</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Cadastro, responsável, validade e etiquetas. O arquivo em si entra na próxima etapa.
          </p>
        </div>
        {data.can.create ? <Button onClick={() => setEditing("new")}>Novo documento</Button> : null}
      </div>

      <section className={`p-4 ${CARD}`} aria-label="Busca e filtros">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            id="busca"
            label="Buscar"
            placeholder="Título, descrição ou etiqueta"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
          />

          <Select
            id="filtro-categoria"
            label="Categoria"
            value={filters.categoryId}
            onChange={(value) => update({ categoryId: value })}
            options={[
              { value: "", label: "Todas" },
              ...data.categories.map((category) => ({ value: category.id, label: categoryLabel(category) })),
            ]}
          />

          <Select
            id="filtro-etiqueta"
            label="Etiqueta"
            value={filters.tag}
            onChange={(value) => update({ tag: value })}
            options={[
              { value: "", label: "Todas" },
              ...tags.map((tag) => ({ value: tag.name, label: `${tag.name} (${tag.documentCount})` })),
            ]}
          />

          <Select
            id="ordenar"
            label="Ordenar por"
            value={filters.sort}
            onChange={(value) => update({ sort: value as DocumentFilters["sort"] })}
            options={[
              { value: "recent", label: "Atualizados primeiro" },
              { value: "title", label: "Título (A–Z)" },
              { value: "created", label: "Mais recentes" },
            ]}
          />
        </div>

        {data.members.length > 0 ? (
          <div className="mt-4 sm:max-w-xs">
            <Select
              id="filtro-responsavel"
              label="Responsável"
              value={filters.responsibleUserId}
              onChange={(value) => update({ responsibleUserId: value })}
              options={[
                { value: "", label: "Qualquer pessoa" },
                ...data.members.map((member) => ({ value: member.userId, label: member.name })),
              ]}
            />
          </div>
        ) : null}
      </section>

      {error ? <Alert>{error}</Alert> : null}

      <section aria-label="Documentos" className={CARD}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <span data-testid="resumo-pagina">{pageSummary(listing.total, listing.page, listing.pageSize)}</span>
          {loading ? <span aria-live="polite">Carregando…</span> : null}
        </div>

        {listing.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-600 dark:text-slate-400">
            Nenhum documento por aqui. {data.can.create ? "Crie o primeiro com “Novo documento”." : null}
          </p>
        ) : (
          <ul data-testid="lista-documentos" className="divide-y divide-slate-200 dark:divide-slate-800">
            {listing.items.map((document) => (
              <li key={document.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{document.title}</p>
                  {document.description ? (
                    <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{document.description}</p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-2 pt-1">
                    {document.category ? <span className={CATEGORY_CHIP}>{document.category.name}</span> : null}
                    {document.tags.map((tag) => (
                      <span key={tag} className={CHIP}>
                        {tag}
                      </span>
                    ))}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {document.responsible ? document.responsible.name : "Sem responsável"}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {document.expirationDate ? `Vence em ${formatCalendarDate(document.expirationDate)}` : "Sem validade"}
                  </span>
                  <span className="flex gap-1">
                    {data.can.update ? (
                      <Button variant="ghost" onClick={() => setEditing(document)}>
                        Editar
                      </Button>
                    ) : null}
                    {data.can.remove ? (
                      confirming === document.id ? (
                        <>
                          <Button variant="secondary" onClick={() => remove(document)}>
                            Confirmar exclusão
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirming(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" onClick={() => setConfirming(document.id)}>
                          Excluir
                        </Button>
                      )
                    ) : null}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button
            variant="secondary"
            disabled={listing.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Página {listing.page} de {lastPage}
          </span>
          <Button
            variant="secondary"
            disabled={listing.page >= lastPage}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
          >
            Próxima
          </Button>
        </div>
      </section>

      {editing ? (
        <DocumentForm
          data={data}
          document={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load(query);
          }}
        />
      ) : null}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  branchId: string;
  departmentId: string;
  responsibleUserId: string;
  issueDate: string;
  expirationDate: string;
  tags: string;
}

const formStateOf = (document: DocumentItem | null): FormState => ({
  title: document?.title ?? "",
  description: document?.description ?? "",
  categoryId: document?.category?.id ?? "",
  branchId: document?.branch?.id ?? "",
  departmentId: document?.department?.id ?? "",
  responsibleUserId: document?.responsible?.userId ?? "",
  issueDate: document?.issueDate ?? "",
  expirationDate: document?.expirationDate ?? "",
  tags: formatTagsInput(document?.tags ?? []),
});

function DocumentForm({
  data,
  document,
  onClose,
  onSaved,
}: {
  readonly data: DocumentsData;
  readonly document: DocumentItem | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => formStateOf(document));
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  // Setor de outra filial não combina com o documento: a lista acompanha a filial.
  const departments = useMemo(
    () => data.departments.filter((department) => !form.branchId || !department.branchId || department.branchId === form.branchId),
    [data.departments, form.branchId],
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    setIssues({});

    const body = {
      title: form.title,
      description: form.description,
      categoryId: form.categoryId,
      branchId: form.branchId,
      departmentId: form.departmentId,
      responsibleUserId: form.responsibleUserId,
      issueDate: form.issueDate,
      expirationDate: form.expirationDate,
      tags: parseTagsInput(form.tags),
    };

    const result = document
      ? await api(`/api/documents/${document.id}`, { method: "PATCH", body })
      : await api("/api/documents", { method: "POST", body });
    setSaving(false);

    if (!result.ok) {
      setIssues(fieldErrors(result.error));
      setError(errorMessage(result.error, "Não foi possível salvar o documento."));
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-formulario"
        data-testid="form-documento"
        className={`w-full max-w-2xl p-6 ${CARD}`}
      >
        <h2 id="titulo-formulario" className="text-xl font-semibold tracking-tight">
          {document ? "Editar documento" : "Novo documento"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              id="titulo"
              label="Título"
              autoFocus
              value={form.title}
              error={issues.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="descricao" className="block text-sm font-medium">
              Descrição
            </label>
            <textarea
              id="descricao"
              rows={3}
              className={SELECT_CLASS}
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>

          <Select
            id="categoria"
            label="Categoria"
            value={form.categoryId}
            onChange={(value) => set({ categoryId: value })}
            options={[
              { value: "", label: "Sem categoria" },
              ...data.categories.map((category) => ({ value: category.id, label: categoryLabel(category) })),
            ]}
          />

          {data.members.length > 0 ? (
            <Select
              id="responsavel"
              label="Responsável"
              value={form.responsibleUserId}
              onChange={(value) => set({ responsibleUserId: value })}
              options={[
                { value: "", label: "Sem responsável" },
                ...data.members.map((member) => ({ value: member.userId, label: member.name })),
              ]}
            />
          ) : null}

          <Select
            id="filial"
            label="Filial"
            value={form.branchId}
            onChange={(value) => set({ branchId: value, departmentId: "" })}
            options={[
              { value: "", label: "Toda a empresa" },
              ...data.branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />

          <Select
            id="setor"
            label="Setor"
            value={form.departmentId}
            onChange={(value) => set({ departmentId: value })}
            options={[
              { value: "", label: "Sem setor" },
              ...departments.map((department) => ({ value: department.id, label: department.name })),
            ]}
          />

          <Field
            id="emissao"
            label="Emissão"
            type="date"
            value={form.issueDate}
            error={issues.issueDate}
            onChange={(event) => set({ issueDate: event.target.value })}
          />

          <Field
            id="validade"
            label="Validade"
            type="date"
            value={form.expirationDate}
            error={issues.expirationDate}
            onChange={(event) => set({ expirationDate: event.target.value })}
          />

          <div className="sm:col-span-2">
            <Field
              id="etiquetas"
              label="Etiquetas"
              hint="Separe por vírgula. Até 10 por documento."
              value={form.tags}
              error={issues.tags}
              onChange={(event) => set({ tags: event.target.value })}
            />
          </div>
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
            Salvar documento
          </Button>
        </div>
      </div>
    </div>
  );
}
