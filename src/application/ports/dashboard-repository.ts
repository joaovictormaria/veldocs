/** Números do cadastro documental da empresa: o que o Core mostra no painel. */
export interface DocumentStats {
  readonly total: number;
  readonly withoutCategory: number;
  readonly withoutResponsible: number;
  readonly withoutExpiration: number;
  /** Criados a partir da data informada. */
  readonly createdSince: number;
}

export interface CategoryCount {
  /** `null`: documentos sem categoria. */
  readonly categoryId: string | null;
  readonly name: string | null;
  readonly count: number;
}

export interface ActivityRecord {
  readonly id: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  /** Título do documento ou nome da categoria, filial ou setor, quando houver. */
  readonly entityName: string | null;
  readonly createdAt: Date;
}

/**
 * Leituras agregadas do painel (MASTER SPEC 11.1), sempre escopadas pelo
 * `companyId` do contexto autorizado.
 */
export interface DashboardRepository {
  documentStats(companyId: string, since: Date): Promise<DocumentStats>;
  /** As categorias com mais documentos vivos; o restante vem somado em `others`. */
  documentsByCategory(
    companyId: string,
    limit: number,
  ): Promise<{ readonly items: readonly CategoryCount[]; readonly others: number }>;
  /** Eventos de auditoria das ações informadas, do mais recente. */
  recentActivity(companyId: string, actions: readonly string[], limit: number): Promise<ActivityRecord[]>;
}
