/** Eventos de auditoria como frases para o painel ("Joana renovou o documento Alvará"). */

const LABELS: Readonly<Record<string, string>> = {
  "document.created": "criou o documento",
  "document.updated": "editou o documento",
  "document.deleted": "excluiu o documento",
  "document.renewed": "renovou o documento",
  "category.created": "criou a categoria",
  "category.updated": "editou a categoria",
  "category.deleted": "excluiu a categoria",
  "member.invited": "convidou uma pessoa",
  "invitation.revoked": "revogou um convite",
  "invitation.accepted": "entrou na empresa por convite",
  "member.roles_changed": "alterou o perfil de um membro",
  "member.suspended": "suspendeu um membro",
  "member.reactivated": "reativou um membro",
  "member.removed": "removeu um membro",
  "company.updated": "atualizou os dados da empresa",
  "branch.created": "criou a filial",
  "branch.updated": "editou a filial",
  "branch.deleted": "excluiu a filial",
  "department.created": "criou o setor",
  "department.updated": "editou o setor",
  "department.deleted": "excluiu o setor",
  "subscription.trial_started": "iniciou o teste grátis",
  "subscription.modules_changed": "alterou os módulos da assinatura",
};

export function activityLabel(action: string): string {
  return LABELS[action] ?? "registrou uma atividade";
}

/** "agora", "há 5 min", "há 3 h", "ontem" ou "há 4 dias". */
export function timeAgo(value: string | Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}
