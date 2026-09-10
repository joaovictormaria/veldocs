/**
 * Contexto de tenant de uma operação.
 *
 * Deve ser resolvido NO SERVIDOR a partir da sessão autenticada (FASE 2) e
 * nunca construído a partir de IDs enviados pelo cliente. Toda consulta,
 * mutação, job assíncrono e log de uma operação empresarial carrega este
 * contexto.
 */
export interface TenantContext {
  readonly companyId: string;
  readonly userId: string;
}
