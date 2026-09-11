/** Convites para entrar numa empresa (FASE 3). */

export const INVITATION_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function invitationExpiresAt(from: Date, days = INVITATION_TTL_DAYS): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * E-mail do convite exibido a quem abre o link: a pessoa convidada reconhece o
 * próprio endereço, mas um link vazado não entrega o e-mail inteiro.
 * `nova.pessoa@example.com` → `no***@example.com`.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const visible = local.slice(0, Math.max(1, Math.min(2, local.length - 1)));
  return `${visible}***${email.slice(at)}`;
}
