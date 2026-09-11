/** Chamadas das telas para a API da própria aplicação (mesma origem, cookie de sessão). */

export interface ApiErrorBody {
  readonly error?: string;
  readonly message?: string;
  readonly issues?: ReadonlyArray<{ readonly field: string; readonly message: string }>;
}

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error: ApiErrorBody };

export async function api<T = unknown>(
  path: string,
  init: { readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; readonly body?: unknown } = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: { message: "Sem conexão com o servidor. Tente de novo." } };
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  return response.ok
    ? { ok: true, status: response.status, data: payload as T }
    : { ok: false, status: response.status, error: (payload ?? {}) as ApiErrorBody };
}

/** Mensagem para a pessoa: problemas de validação, mensagem da API ou o texto padrão. */
export function errorMessage(error: ApiErrorBody | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.issues && error.issues.length > 0) return error.issues.map((issue) => issue.message).join("; ");
  return error.message ?? fallback;
}

/** Erros de validação por campo, para exibir junto de cada input. */
export function fieldErrors(error: ApiErrorBody | null | undefined): Record<string, string> {
  return Object.fromEntries((error?.issues ?? []).map((issue) => [issue.field, issue.message]));
}

/** Destino depois do login: só caminhos internos, para não virar redirecionamento aberto. */
export function safeNextPath(value: string | null | undefined, fallback = "/inicio"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
