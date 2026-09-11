/**
 * Porta de canal de notificação (in-app, e-mail, WhatsApp).
 * Somente contrato — implementação prevista com os alertas da FASE 4.
 *
 * Envios serão executados por workers assíncronos que preservam o contexto
 * de tenant (`companyId`) e devem ser idempotentes (`idempotencyKey`).
 */
export type NotificationChannelType = "in_app" | "email" | "whatsapp";

export interface NotificationMessage {
  readonly companyId: string;
  readonly recipientUserId: string;
  /** Tipo do evento (ex.: "document.expiring"). */
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export interface NotificationChannel {
  readonly channel: NotificationChannelType;
  send(message: NotificationMessage): Promise<void>;
}
