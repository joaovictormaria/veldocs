/**
 * Porta do provedor WhatsApp Business API.
 * Somente contrato — implementação prevista para a FASE 15 (WhatsApp).
 *
 * Regras de segurança:
 * - webhooks só são processados após validação de assinatura;
 * - o número é apenas um identificador: tenant e permissões são resolvidos no
 *   backend (número → usuário → empresa → permissões);
 * - proteção contra replay e rate limiting na camada de aplicação.
 */
export interface WhatsAppOutboundMessage {
  readonly companyId: string;
  /** Telefone no formato E.164 (ex.: +5511999999999). */
  readonly toPhoneE164: string;
  readonly text: string;
}

export interface WebhookVerificationInput {
  /** Corpo bruto, exatamente como recebido (necessário para validar a assinatura). */
  readonly rawBody: string;
  readonly signatureHeader: string | null;
}

export interface WhatsAppProvider {
  sendMessage(message: WhatsAppOutboundMessage): Promise<{ readonly providerMessageId: string }>;
  verifyWebhookSignature(input: WebhookVerificationInput): Promise<boolean>;
}
