import type { AuditLogger } from "@/application/ports/audit-logger";
import type { PrismaClient } from "@/generated/prisma/client";

export function createPrismaAuditLogger(prisma: PrismaClient): AuditLogger {
  return {
    async record(event) {
      await prisma.auditLog.create({
        data: {
          companyId: event.companyId,
          actorUserId: event.actorUserId,
          action: event.action,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          ...(event.metadata ? { metadata: { ...event.metadata } } : {}),
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent?.slice(0, 512) ?? null,
          requestId: event.requestId ?? null,
        },
      });
    },
  };
}
