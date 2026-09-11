import { beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import {
  ACTIVITY_LIMIT,
  CATEGORY_LIMIT,
  createDashboardQueries,
  DASHBOARD_ACTIVITY_ACTIONS,
  UPCOMING_LIMIT,
} from "@/application/dashboard/dashboard-queries";
import type { ExpirationManagement } from "@/application/documents/manage-expirations";
import type { DashboardRepository } from "@/application/ports/dashboard-repository";
import { createFakeClock } from "../auth/fakes";

const COMPANY = "company-1";

const contextWith = (permissions: string[]): AuthorizedContext => ({
  companyId: COMPANY,
  userId: "user-1",
  roleKeys: ["GESTOR"],
  permissions,
});

function setup() {
  const calls: string[] = [];
  let since: Date | null = null;
  let actions: readonly string[] = [];

  const repository: DashboardRepository = {
    async documentStats(companyId, from) {
      calls.push(`documentStats:${companyId}`);
      since = from;
      return { total: 12, withoutCategory: 3, withoutResponsible: 4, withoutExpiration: 5, createdSince: 2 };
    },
    async documentsByCategory(companyId, limit) {
      calls.push(`documentsByCategory:${companyId}:${limit}`);
      return { items: [{ categoryId: "cat-1", name: "Fiscal", count: 7 }], others: 1 };
    },
    async recentActivity(companyId, requested, limit) {
      calls.push(`recentActivity:${companyId}:${limit}`);
      actions = requested;
      return [
        {
          id: "evt-1",
          action: "document.created",
          actorName: "Joana",
          entityType: "Document",
          entityId: "doc-1",
          entityName: "Alvará",
          createdAt: new Date("2026-09-11T11:00:00.000Z"),
        },
      ];
    },
  };

  const summaries: unknown[] = [];
  const expirations: Pick<ExpirationManagement, "summary"> = {
    async summary(context, query) {
      summaries.push({ companyId: context.companyId, query });
      return {
        ok: true,
        data: {
          today: "2026-09-11",
          windowDays: 30,
          counts: { valid: 1, expiring: 2, expired: 3, withoutExpiration: 5, total: 11 },
          upcoming: [],
        },
      };
    },
  };

  const dashboard = createDashboardQueries({ repository, expirations, now: createFakeClock().now });
  return { dashboard, calls, summaries, since: () => since, actions: () => actions };
}

let fake: ReturnType<typeof setup>;

beforeEach(() => {
  fake = setup();
});

describe("painel", () => {
  it("monta o cadastro documental e renomeia a contagem dos últimos 30 dias", async () => {
    const summary = await fake.dashboard.summary(contextWith(["documents.read"]), { expirations: false });

    expect(summary).toMatchObject({
      today: "2026-09-11",
      documents: { total: 12, withoutCategory: 3, withoutResponsible: 4, withoutExpiration: 5, createdLast30Days: 2 },
      categories: { items: [{ name: "Fiscal", count: 7 }], others: 1 },
    });
    // Os 30 dias começam à meia-noite do dia, contados a partir de hoje em Brasília.
    expect(fake.since()?.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(fake.calls).toContain(`documentsByCategory:${COMPANY}:${CATEGORY_LIMIT}`);
  });

  it("sem o módulo, não consulta nem devolve vencimentos", async () => {
    const summary = await fake.dashboard.summary(contextWith(["documents.read"]), { expirations: false });

    expect(summary.expirations).toBeNull();
    expect(fake.summaries).toEqual([]);
  });

  it("com o módulo, traz o resumo de vencimentos com poucos itens", async () => {
    const summary = await fake.dashboard.summary(contextWith(["documents.read"]), { expirations: true });

    expect(summary.expirations?.counts).toMatchObject({ expired: 3, expiring: 2 });
    expect(fake.summaries).toEqual([{ companyId: COMPANY, query: { limit: UPCOMING_LIMIT } }]);
  });

  it("atividade recente só para quem pode ver a auditoria", async () => {
    const semAuditoria = await fake.dashboard.summary(contextWith(["documents.read"]), { expirations: false });
    expect(semAuditoria.activity).toBeNull();
    expect(fake.calls.some((call) => call.startsWith("recentActivity"))).toBe(false);

    const comAuditoria = await fake.dashboard.summary(contextWith(["documents.read", "audit.read"]), {
      expirations: false,
    });
    expect(comAuditoria.activity).toEqual([expect.objectContaining({ action: "document.created", actorName: "Joana" })]);
    expect(fake.calls).toContain(`recentActivity:${COMPANY}:${ACTIVITY_LIMIT}`);
    expect(fake.actions()).toEqual(DASHBOARD_ACTIVITY_ACTIONS);
  });
});

describe("o que entra na atividade recente", () => {
  it("ações sobre os dados da empresa, nunca eventos de acesso", () => {
    expect(DASHBOARD_ACTIVITY_ACTIONS).toEqual(
      expect.arrayContaining([
        "document.created",
        "document.renewed",
        "category.deleted",
        "member.invited",
        "subscription.modules_changed",
      ]),
    );
    expect(DASHBOARD_ACTIVITY_ACTIONS.some((action) => action.startsWith("auth."))).toBe(false);
    expect(new Set(DASHBOARD_ACTIVITY_ACTIONS).size).toBe(DASHBOARD_ACTIVITY_ACTIONS.length);
  });
});
