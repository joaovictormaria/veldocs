"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/presentation/api-client";
import { Alert, Button } from "@/presentation/components/ui";
import { formatBytes } from "@/presentation/format";

interface DocumentFile {
  readonly id: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: { readonly name: string };
  readonly availableAt: string | null;
}

interface UploadRequest {
  readonly file: { readonly id: string };
  readonly upload: { readonly url: string; readonly fields: Readonly<Record<string, string>> };
}

/** Mesma allowlist do servidor; o navegador só ajuda a escolher. */
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

/**
 * Arquivos de um documento (FASE 5). O arquivo vai direto ao bucket privado
 * por formulário assinado; o servidor confere o conteúdo antes de liberar.
 */
export function DocumentFiles({
  documentId,
  enabled,
  canEdit,
}: {
  readonly documentId: string;
  readonly enabled: boolean;
  readonly canEdit: boolean;
}) {
  const [files, setFiles] = useState<readonly DocumentFile[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    const result = await api<{ files: readonly DocumentFile[] }>(`/api/documents/${documentId}/files`);
    if (result.ok) setFiles(result.data.files);
    else setError(errorMessage(result.error, "Não foi possível carregar os arquivos."));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<{ files: readonly DocumentFile[] }>(`/api/documents/${documentId}/files`);
      if (cancelled) return;
      if (result.ok) setFiles(result.data.files);
      else setError(errorMessage(result.error, "Não foi possível carregar os arquivos."));
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const upload = async (file: File) => {
    setError(null);
    setStatus(`Enviando ${file.name}…`);

    const requested = await api<UploadRequest>(`/api/documents/${documentId}/files`, {
      method: "POST",
      body: { fileName: file.name, contentType: file.type, sizeBytes: file.size },
    });
    if (!requested.ok) {
      setStatus(null);
      setError(errorMessage(requested.error, "Não foi possível enviar o arquivo."));
      return;
    }

    // Campos assinados primeiro e o arquivo por último, como o S3 exige.
    const form = new FormData();
    for (const [name, value] of Object.entries(requested.data.upload.fields)) form.append(name, value);
    form.append("file", file);

    let sent: Response;
    try {
      sent = await fetch(requested.data.upload.url, { method: "POST", body: form });
    } catch {
      setStatus(null);
      setError("Não foi possível falar com o armazenamento. Tente de novo.");
      return;
    }
    if (!sent.ok) {
      setStatus(null);
      setError("O armazenamento recusou o arquivo.");
      return;
    }

    setStatus("Conferindo o arquivo…");
    const completed = await api(`/api/documents/${documentId}/files/${requested.data.file.id}/complete`, {
      method: "POST",
    });
    setStatus(null);
    if (!completed.ok) {
      setError(errorMessage(completed.error, "O arquivo não passou na conferência."));
      return;
    }
    await load();
  };

  const remove = async (file: DocumentFile) => {
    setConfirming(null);
    const result = await api(`/api/documents/${documentId}/files/${file.id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(errorMessage(result.error, "Não foi possível remover o arquivo."));
      return;
    }
    await load();
  };

  return (
    <section aria-labelledby="titulo-arquivos" data-testid="arquivos-documento" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-arquivos" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Arquivos
        </h3>
        {enabled && canEdit ? (
          <>
            <label htmlFor="arquivo" className="sr-only">
              Anexar arquivo
            </label>
            <input
              ref={input}
              id="arquivo"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={async (event) => {
                const chosen = event.target.files?.[0];
                event.target.value = "";
                if (chosen) await upload(chosen);
              }}
            />
            <Button variant="secondary" loading={status !== null} onClick={() => input.current?.click()}>
              Anexar arquivo
            </Button>
          </>
        ) : null}
      </div>

      {!enabled ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">O envio de arquivos não está disponível neste ambiente.</p>
      ) : (
        <p className="text-xs text-slate-500">PDF, JPEG, PNG ou WebP, até 25 MB. O conteúdo é conferido depois do envio.</p>
      )}

      {status ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          {status}
        </p>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}

      {files === null ? null : files.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum arquivo anexado.</p>
      ) : (
        <ul data-testid="lista-arquivos" className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{file.fileName}</span>
                <span className="text-xs text-slate-500">
                  {formatBytes(file.sizeBytes)} · enviado por {file.uploadedBy.name}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {/* Navegação comum: o servidor autoriza e redireciona para a URL assinada. */}
                <a
                  href={`/api/documents/${documentId}/files/${file.id}/download`}
                  className="rounded-lg px-3 py-1.5 font-medium text-brand-dark hover:bg-slate-100 dark:text-brand-cyan dark:hover:bg-slate-800"
                >
                  Baixar
                </a>
                {canEdit ? (
                  confirming === file.id ? (
                    <>
                      <Button variant="secondary" onClick={() => remove(file)}>
                        Confirmar remoção
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirming(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirming(file.id)}>
                      Remover
                    </Button>
                  )
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
