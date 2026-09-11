import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createExpirationManagement } from "@/application/documents/manage-expirations";
import type { DocumentRecord, DocumentRepository, RenewalInput } from "@/application/ports/document-repository";
import { createFakeAudit, createFakeClock } from "../auth/fakes";

const COMPANY = "company-1";
const request = { ipAddress: "203.0.113.12", userAgent: "vitest" };
const at = new Date("2026-09-11T12:00:00.000Z");

const context: AuthorizedContext = {
  companyId: COMPANY,
  userId: "user-1",
  roleKeys: ["GESTOR"],
  permissions: ["expirations.read", "expirations.manage"],
};

const documentOf = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: "doc-1",
  title: "Alvará",
  description: null,
  category: null,
  branch: null,
  department: null,
  responsible: null,
  createdBy: null,
  issueDate: "2025-09-11",
  expirationDate: "2026-09-20",
  tags: [],
  createdAt: at,
  updatedAt: at,
  ...overrides,
});

function createFakeRepository(initial: DocumentRecord[] = [documentOf()]) {
  let documents = initial;
  const summaries: Array<{ today: string; windowEnd: string; limit: number }> = [];
  const renewals: Array<{ documentId: string; input: RenewalInput }> = [];

  const repository = {
    async findDocument(_companyId: string, documentId: string) {
      return documents.find((document) => document.id === documentId) ?? null;
    },
    async renewDocument(_companyId: string, documentId: string, input: RenewalInput) {
      renewals.push({ documentId, input });
      const current = documents.find((document) => document.id === documentId);
      if (!current) return null;
      const renewed = documentOf({ ...current, ...input });
      documents = documents.map((document) => (document.id === documentId ? renewed : document));
      return renewed;
    },
    async summarizeExpirations(_companyId: string, options: { today: string; windowEnd: string; limit: number }) {
      summaries.push(options);
      return {
        counts: { valid: 4, expiring: 2, expired: 1, withoutExpiration: 3, total: 10 },
        upcoming: documents,
      };
    },
  } as unknown as DocumentRepository;

  return { repository, summaries, renewals };
}

let fake: ReturnType<typeof createFakeRepository>;
let audit: ReturnType<typeof createFakeAudit>;
let expirations: ReturnType<typeof createExpirationManagement>;

const unwrap = <T>(result: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
};

const refuse = <T>(result: { ok: true; data: T } | { ok: false; reason: string; issues?: unknown }) => {
  if (result.ok) throw new Error("esperava recusa");
  return result;
};

const setup = (documents?: DocumentRecord[]) => {
  fake = createFakeRepository(documents);
  audit = createFakeAudit();
  expirations = createExpirationManagement({
    repository: fake.repository,
    audit: audit.audit,
    now: createFakeClock().now,
  });
};

beforeEach(() => setup());

describe("painel de vencimentos", () => {
  it("usa hoje em Brasília e a janela de 30 dias por padrão", async () => {
    const summary = unwrap(await expirations.summary(context, {}));

    expect(fake.summaries).toEqual([{ today: "2026-09-11", windowEnd: "2026-10-11", limit: 10 }]);
    expect(summary).toMatchObject({
      today: "2026-09-11",
      windowDays: 30,
      counts: { valid: 4, expiring: 2, expired: 1, withoutExpiration: 3, total: 10 },
    });
  });

  it("calcula situação e dias restantes de cada documento da lista", async () => {
    setup([
      documentOf({ id: "vence-logo", expirationDate: "2026-09-20" }),
      documentOf({ id: "vencido", expirationDate: "2026-09-01" }),
    ]);

    const summary = unwrap(await expirations.summary(context, {}));

    expect(summary.upcoming).toEqual([
      expect.objectContaining({ id: "vence-logo", expirationStatus: "EXPIRING", daysRemaining: 9 }),
      expect.objectContaining({ id: "vencido", expirationStatus: "EXPIRED", daysRemaining: -10 }),
    ]);
  });

  it("aceita encurtar a janela e limitar a lista", async () => {
    const summary = unwrap(await expirations.summary(context, { days: "7", limit: "3" }));

    expect(fake.summaries.at(-1)).toEqual({ today: "2026-09-11", windowEnd: "2026-09-18", limit: 3 });
    expect(summary.windowDays).toBe(7);
  });

  it("recusa janela e limite fora do permitido", async () => {
    const result = refuse(await expirations.summary(context, { days: "0", limit: "500" }));

    expect((result.issues as Array<{ field: string }>).map((issue) => issue.field).sort()).toEqual(["days", "limit"]);
  });
});

describe("renovação", () => {
  it("troca as datas, mantém o resto e audita com a validade anterior", async () => {
    const renewed = unwrap(
      await expirations.renew(context, "doc-1", { issueDate: "2026-09-11", expirationDate: "2027-09-11" }, request),
    );

    expect(renewed).toMatchObject({ title: "Alvará", issueDate: "2026-09-11", expirationDate: "2027-09-11" });
    expect(fake.renewals).toEqual([
      { documentId: "doc-1", input: { issueDate: "2026-09-11", expirationDate: "2027-09-11" } },
    ]);
    expect(audit.events).toEqual([
      expect.objectContaining({
        companyId: COMPANY,
        actorUserId: "user-1",
        action: "document.renewed",
        entityType: "Document",
        entityId: "doc-1",
        metadata: {
          previousIssueDate: "2025-09-11",
          previousExpirationDate: "2026-09-20",
          issueDate: "2026-09-11",
          expirationDate: "2027-09-11",
        },
      }),
    ]);
  });

  it("a nova validade precisa avançar", async () => {
    for (const expirationDate of ["2026-09-20", "2026-09-19"]) {
      const result = refuse(await expirations.renew(context, "doc-1", { expirationDate }, request));
      expect(result.issues).toEqual([
        { field: "expirationDate", message: "a nova validade precisa ser posterior à atual" },
      ]);
    }
    expect(fake.renewals).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it("documento que ainda não tinha validade pode receber uma", async () => {
    setup([documentOf({ expirationDate: null, issueDate: null })]);

    const renewed = unwrap(await expirations.renew(context, "doc-1", { expirationDate: "2027-01-01" }, request));

    expect(renewed.expirationDate).toBe("2027-01-01");
    expect(audit.events.at(-1)).toMatchObject({ metadata: { previousExpirationDate: null } });
  });

  it("recusa validade anterior à emissão e data inválida", async () => {
    expect(
      refuse(await expirations.renew(context, "doc-1", { issueDate: "2027-02-01", expirationDate: "2027-01-01" }, request))
        .issues,
    ).toEqual([{ field: "expirationDate", message: "a validade não pode ser anterior à emissão" }]);

    expect(refuse(await expirations.renew(context, "doc-1", { expirationDate: "31/12/2027" }, request)).reason).toBe(
      "invalid_input",
    );
    expect(audit.events).toEqual([]);
  });

  it("documento inexistente não é renovado nem auditado", async () => {
    expect(await expirations.renew(context, randomUUID(), { expirationDate: "2028-01-01" }, request)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(audit.events).toEqual([]);
  });
});
