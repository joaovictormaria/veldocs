"use client";

import { useState } from "react";
import { api, errorMessage, fieldErrors } from "@/presentation/api-client";
import { Alert, Button, CARD, Field } from "@/presentation/components/ui";

export interface CategoryNode {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly path: readonly string[];
  readonly depth: number;
  readonly documentCount: number;
}

export interface CategoriesData {
  readonly categories: readonly CategoryNode[];
  readonly maxDepth: number;
  readonly can: { readonly manage: boolean };
}

const SELECT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 dark:border-slate-700 dark:bg-slate-950";

/** Categorias de documentos (MASTER SPEC 10.1). `data` nulo: perfil sem permissão de leitura. */
export function CategoriesClient({ data }: { readonly data: CategoriesData | null }) {
  if (!data) {
    return <Alert tone="info">Seu perfil não tem permissão para ver as categorias desta empresa.</Alert>;
  }
  return <CategoryTree data={data} />;
}

function CategoryTree({ data }: { readonly data: CategoriesData }) {
  const [categories, setCategories] = useState(data.categories);
  const [editing, setEditing] = useState<CategoryNode | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const result = await api<{ categories: readonly CategoryNode[] }>("/api/categories");
    if (result.ok) setCategories(result.data.categories);
    else setError(errorMessage(result.error, "Não foi possível carregar as categorias."));
  };

  const remove = async (category: CategoryNode) => {
    setConfirming(null);
    setError(null);
    const result = await api(`/api/categories/${category.id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(
        result.status === 409
          ? `“${category.name}” ainda tem subcategorias ou documentos e não pode ser excluída.`
          : errorMessage(result.error, "Não foi possível excluir a categoria."),
      );
      return;
    }
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Categorias</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Organize os documentos em até {data.maxDepth} níveis. Categoria com documentos ou subcategorias não pode ser
            excluída.
          </p>
        </div>
        {data.can.manage ? <Button onClick={() => setEditing("new")}>Nova categoria</Button> : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <section aria-label="Categorias" className={CARD}>
        {categories.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-600 dark:text-slate-400">
            Nenhuma categoria ainda. {data.can.manage ? "Comece com “Nova categoria”." : null}
          </p>
        ) : (
          <ul data-testid="lista-categorias" className="divide-y divide-slate-200 dark:divide-slate-800">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                {/* O recuo mostra o nível; o caminho completo fica no título. */}
                <div style={{ paddingLeft: `${(category.depth - 1) * 1.5}rem` }} className="min-w-0">
                  <p className="font-medium" title={category.path.join(" › ")}>
                    {category.name}
                  </p>
                  {category.description ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{category.description}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {category.documentCount === 1 ? "1 documento" : `${category.documentCount} documentos`}
                  </p>
                </div>

                {data.can.manage ? (
                  <span className="flex gap-1">
                    <Button variant="ghost" onClick={() => setEditing(category)}>
                      Editar
                    </Button>
                    {confirming === category.id ? (
                      <>
                        <Button variant="secondary" onClick={() => remove(category)}>
                          Confirmar exclusão
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirming(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => setConfirming(category.id)}>
                        Excluir
                      </Button>
                    )}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <CategoryForm
          categories={categories}
          maxDepth={data.maxDepth}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryForm({
  categories,
  maxDepth,
  category,
  onClose,
  onSaved,
}: {
  readonly categories: readonly CategoryNode[];
  readonly maxDepth: number;
  readonly category: CategoryNode | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Só quem ainda tem espaço abaixo, e nunca a própria categoria ou uma descendente. */
  const parents = categories.filter((candidate) => {
    if (candidate.depth >= maxDepth) return false;
    if (!category) return true;
    return candidate.id !== category.id && !candidate.path.includes(category.name);
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    setIssues({});

    const body = { name, description, parentId };
    const result = category
      ? await api(`/api/categories/${category.id}`, { method: "PATCH", body })
      : await api("/api/categories", { method: "POST", body });
    setSaving(false);

    if (!result.ok) {
      setIssues(fieldErrors(result.error));
      setError(
        result.status === 409
          ? "Já existe uma categoria com esse nome no mesmo nível."
          : errorMessage(result.error, "Não foi possível salvar a categoria."),
      );
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-categoria"
        data-testid="form-categoria"
        className={`w-full max-w-lg p-6 ${CARD}`}
      >
        <h2 id="titulo-categoria" className="text-xl font-semibold tracking-tight">
          {category ? "Editar categoria" : "Nova categoria"}
        </h2>

        <div className="mt-6 space-y-4">
          <Field
            id="nome-categoria"
            label="Nome"
            autoFocus
            value={name}
            error={issues.name}
            onChange={(event) => setName(event.target.value)}
          />

          <Field
            id="descricao-categoria"
            label="Descrição"
            value={description}
            error={issues.description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <div className="space-y-1.5">
            <label htmlFor="categoria-superior" className="block text-sm font-medium">
              Categoria superior
            </label>
            <select
              id="categoria-superior"
              className={SELECT_CLASS}
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Nenhuma (categoria principal)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.path.join(" › ")}
                </option>
              ))}
            </select>
            {issues.parentId ? <p className="text-sm text-red-600 dark:text-red-400">{issues.parentId}</p> : null}
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
            Salvar categoria
          </Button>
        </div>
      </div>
    </div>
  );
}
