/**
 * Porta de auditoria (tabela `audit_logs`, append-only).
 */
export interface AuditEvent {
  /** null para eventos sem empresa (ex.: login, cadastro da pessoa). */
  readonly companyId: string | null;
  /** null para ações do sistema ou tentativas sem pessoa identificada. */
  readonly actorUserId: string | null;
  /** Ex.: "auth.login_succeeded". */
  readonly action: string;
  readonly entityType?: string;
  readonly entityId?: string;
  /** Nunca incluir senhas, tokens, CPF, e-mail digitado ou conteúdo de documentos. */
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly requestId?: string | null;
}

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}
