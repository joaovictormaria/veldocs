import type { AuthorizedContext } from "@/application/access/authorize";
import { COMPANY_MANAGEMENT_AUDIT_ACTIONS } from "@/application/access/manage-company";
import { MEMBER_AUDIT_ACTIONS } from "@/application/access/manage-members";
import { SUBSCRIPTION_AUDIT_ACTIONS } from "@/application/billing/subscription-use-cases";
import { CATEGORY_AUDIT_ACTIONS } from "@/application/documents/manage-categories";
import { DOCUMENT_AUDIT_ACTIONS } from "@/application/documents/manage-documents";
import {
  EXPIRATION_AUDIT_ACTIONS,
  type ExpirationManagement,
  type ExpirationSummary,
} from "@/application/documents/manage-expirations";
import type {
  ActivityRecord,
  CategoryCount,
  DashboardRepository,
  DocumentStats,
} from "@/application/ports/dashboard-repository";
import { addDays, todayInBrazil } from "@/domain/documents/expiration";

export const RECENT_DAYS = 30;
export const CATEGORY_LIMIT = 6;
export const ACTIVITY_LIMIT = 8;
export const UPCOMING_LIMIT = 5;

/**
 * O que entra em "Atividade recente": ações sobre os dados da empresa.
 * Eventos de acesso (login, segundo fator, sessão) ficam de fora — dizem
 * respeito a cada pessoa, não à rotina documental da equipe.
 */
export const DASHBOARD_ACTIVITY_ACTIONS: readonly string[] = [
  ...Object.values(DOCUMENT_AUDIT_ACTIONS),
  ...Object.values(EXPIRATION_AUDIT_ACTIONS),
  ...Object.values(CATEGORY_AUDIT_ACTIONS),
  ...Object.values(MEMBER_AUDIT_ACTIONS),
  ...Object.values(COMPANY_MANAGEMENT_AUDIT_ACTIONS),
  ...Object.values(SUBSCRIPTION_AUDIT_ACTIONS),
];

export interface DashboardSummary {
  /** Hoje em Brasília. */
  readonly today: string;
  readonly documents: Omit<DocumentStats, "createdSince"> & { readonly createdLast30Days: number };
  readonly categories: { readonly items: readonly CategoryCount[]; readonly others: number };
  /** Só com o módulo Controle de vencimentos. */
  readonly expirations: ExpirationSummary | null;
  /** Só para quem pode ver a trilha de auditoria (`audit.read`). */
  readonly activity: readonly ActivityRecord[] | null;
}

/**
 * Painel da empresa (MASTER SPEC 11.1). O Core mostra o cadastro documental e
 * a distribuição por categoria; os vencimentos entram com o módulo; a atividade
 * recente, para quem tem `audit.read`. Cada parte obedece à sua própria regra,
 * então um perfil vê só o que já poderia ver pelas outras telas.
 */
export function createDashboardQueries(deps: {
  readonly repository: DashboardRepository;
  readonly expirations: Pick<ExpirationManagement, "summary">;
  readonly now: () => Date;
}) {
  return {
    async summary(context: AuthorizedContext, options: { readonly expirations: boolean }): Promise<DashboardSummary> {
      const now = deps.now();
      const today = todayInBrazil(now);
      // Meia-noite UTC do dia de 30 dias atrás: a janela inclui o dia inteiro.
      const since = new Date(`${addDays(today, -RECENT_DAYS)}T00:00:00.000Z`);
      const canReadAudit = context.permissions.includes("audit.read");

      const [stats, categories, expirations, activity] = await Promise.all([
        deps.repository.documentStats(context.companyId, since),
        deps.repository.documentsByCategory(context.companyId, CATEGORY_LIMIT),
        options.expirations ? deps.expirations.summary(context, { limit: UPCOMING_LIMIT }) : null,
        canReadAudit
          ? deps.repository.recentActivity(context.companyId, DASHBOARD_ACTIVITY_ACTIONS, ACTIVITY_LIMIT)
          : null,
      ]);

      const { createdSince, ...documents } = stats;
      return {
        today,
        documents: { ...documents, createdLast30Days: createdSince },
        categories,
        expirations: expirations?.ok ? expirations.data : null,
        activity,
      };
    },
  };
}

export type DashboardQueries = ReturnType<typeof createDashboardQueries>;
