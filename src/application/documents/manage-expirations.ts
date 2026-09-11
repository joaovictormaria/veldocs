import { z } from "zod";
import type { AuthorizedContext } from "@/application/access/authorize";
import type { ValidationIssue, WriteResult } from "@/application/access/manage-company";
import { auditContext, type RequestContext } from "@/application/auth/shared";
import type { AuditLogger } from "@/application/ports/audit-logger";
import type { DocumentRecord, DocumentRepository, ExpirationCounts } from "@/application/ports/document-repository";
import { calendarDateSchema } from "@/domain/documents/document-dates";
import {
  EXPIRING_WINDOW_DAYS,
  type ExpirationStatus,
  daysUntil,
  expirationStatus,
  expiringWindowEnd,
  todayInBrazil,
} from "@/domain/documents/expiration";

export const EXPIRATION_AUDIT_ACTIONS = { renewed: "document.renewed" } as const;

export const DEFAULT_UPCOMING_LIMIT = 10;
export const MAX_UPCOMING_LIMIT = 50;

/** Campo opcional: ausente, nulo ou string vazia viram `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal("").transform(() => null), schema])
    .nullish()
    .transform((value) => value ?? null);

export const expirationQuerySchema = z.object({
  /** Janela do alerta, em dias. */
  days: z.coerce.number().int().min(1).max(365).default(EXPIRING_WINDOW_DAYS),
  limit: z.coerce.number().int().min(1).max(MAX_UPCOMING_LIMIT).default(DEFAULT_UPCOMING_LIMIT),
});

export const renewalInputSchema = z
  .object({
    issueDate: optional(calendarDateSchema),
    expirationDate: calendarDateSchema,
  })
  .refine((value) => !value.issueDate || value.expirationDate >= value.issueDate, {
    error: "a validade não pode ser anterior à emissão",
    path: ["expirationDate"],
  });

export interface ExpiringDocument extends DocumentRecord {
  readonly expirationStatus: ExpirationStatus;
  /** Negativo quando já venceu; 0 no próprio dia. */
  readonly daysRemaining: number;
}

export interface ExpirationSummary {
  /** Hoje em Brasília: é o dia que define a situação (MASTER SPEC 10.2). */
  readonly today: string;
  readonly windowDays: number;
  readonly counts: ExpirationCounts;
  /** Vencidos e a vencer na janela, do mais urgente para o menos. */
  readonly upcoming: readonly ExpiringDocument[];
}

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ field: issue.path.join(".") || "(raiz)", message: issue.message }));

const invalid = (issues: readonly ValidationIssue[]): WriteResult<never> => ({
  ok: false,
  reason: "invalid_input",
  issues,
});

const withoutEmptyValues = (raw: unknown): unknown =>
  typeof raw === "object" && raw !== null
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, value]) => value !== ""))
    : raw;

/**
 * Controle de vencimentos (MASTER SPEC 10.2), capacidade do módulo pago
 * `vencimentos`: situação derivada da validade, painel de alertas e renovação.
 * O entitlement é conferido na autorização (`expirations.*`), não aqui.
 */
export function createExpirationManagement(deps: {
  readonly repository: DocumentRepository;
  readonly audit: AuditLogger;
  readonly now: () => Date;
}) {
  return {
    async summary(context: AuthorizedContext, rawQuery: unknown): Promise<WriteResult<ExpirationSummary>> {
      const query = expirationQuerySchema.safeParse(withoutEmptyValues(rawQuery));
      if (!query.success) return invalid(issuesOf(query.error));

      const { days, limit } = query.data;
      const today = todayInBrazil(deps.now());
      const { counts, upcoming } = await deps.repository.summarizeExpirations(context.companyId, {
        today,
        windowEnd: expiringWindowEnd(today, days),
        limit,
      });

      return {
        ok: true,
        data: {
          today,
          windowDays: days,
          counts,
          upcoming: upcoming.map((document) => ({
            ...document,
            expirationStatus: expirationStatus(document.expirationDate, today, days),
            // Só entra na lista quem tem validade, então a data existe.
            daysRemaining: daysUntil(document.expirationDate as string, today),
          })),
        },
      };
    },

    /**
     * Renovação: novas datas, mesmo documento. A validade precisa avançar —
     * corrigir uma data para trás é edição, não renovação, e o histórico fica
     * na auditoria com a validade anterior.
     */
    async renew(
      context: AuthorizedContext,
      documentId: string,
      rawInput: unknown,
      request: RequestContext,
    ): Promise<WriteResult<DocumentRecord>> {
      const input = renewalInputSchema.safeParse(rawInput);
      if (!input.success) return invalid(issuesOf(input.error));

      const current = await deps.repository.findDocument(context.companyId, documentId);
      if (!current) return { ok: false, reason: "not_found" };

      if (current.expirationDate !== null && input.data.expirationDate <= current.expirationDate) {
        return invalid([{ field: "expirationDate", message: "a nova validade precisa ser posterior à atual" }]);
      }

      const renewed = await deps.repository.renewDocument(context.companyId, documentId, input.data, deps.now());
      if (!renewed) return { ok: false, reason: "not_found" };

      await deps.audit.record({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: EXPIRATION_AUDIT_ACTIONS.renewed,
        entityType: "Document",
        entityId: documentId,
        metadata: {
          previousIssueDate: current.issueDate,
          previousExpirationDate: current.expirationDate,
          issueDate: renewed.issueDate,
          expirationDate: renewed.expirationDate,
        },
        ...auditContext(request),
      });

      return { ok: true, data: renewed };
    },
  };
}

export type ExpirationManagement = ReturnType<typeof createExpirationManagement>;
