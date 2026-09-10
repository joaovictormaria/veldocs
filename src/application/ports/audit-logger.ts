/**
 * Porta de auditoria. A tabela `audit_logs` já existe (append-only);
 * a implementação e o registro dos eventos pertencem às fases 2 e 12.
 */
export interface AuditEvent {
  /** null apenas para eventos sem tenant resolvido (ex.: falha de login). */
  readonly companyId: string | null;
  /** null para ações do sistema. */
  readonly actorUserId: string | null;
  /** Ex.: "document.created". */
  readonly action: string;
  readonly entityType?: string;
  readonly entityId?: string;
  /** Nunca incluir segredos, tokens ou conteúdo sensível de documentos. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}
