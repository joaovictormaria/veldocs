import type { TenantContext } from "@/domain/shared/tenant-context";

/**
 * Porta do provedor de IA, desacoplada de fornecedor específico.
 * Somente contrato — implementação prevista para a FASE 13 (IA e OCR).
 *
 * Regras de segurança (DEC-005 — IA via tools autorizadas):
 * - a IA NUNCA acessa o banco diretamente; recebe apenas dados já autorizados
 *   por serviços da aplicação (usuário → tenant → permissão → recurso → ação);
 * - conteúdo de documentos é dado NÃO CONFIÁVEL (risco de prompt injection);
 * - toda chamada é atribuída a um tenant para limite de custo, rate limit e logs.
 */
export interface AiMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
  /** Marca conteúdo vindo de fontes não confiáveis (ex.: texto extraído de documento). */
  readonly untrusted?: boolean;
}

export interface AiCompletionRequest {
  readonly tenant: TenantContext;
  /** Finalidade auditável da chamada (ex.: "document.summary"). */
  readonly purpose: string;
  readonly messages: readonly AiMessage[];
  readonly maxOutputTokens: number;
}

export interface AiCompletionResult {
  readonly text: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
