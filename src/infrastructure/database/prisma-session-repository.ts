import type { SessionRepository } from "@/application/ports/session-repository";
import type { PrismaClient } from "@/generated/prisma/client";

export function createPrismaSessionRepository(prisma: PrismaClient): SessionRepository {
  return {
    async create(session) {
      await prisma.session.create({
        data: {
          id: session.id,
          userId: session.userId,
          activeCompanyId: session.activeCompanyId,
          createdAt: session.createdAt,
          lastSeenAt: session.createdAt,
          expiresAt: session.expiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent?.slice(0, 512) ?? null,
        },
      });
    },

    findById(id) {
      return prisma.session.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          activeCompanyId: true,
          expiresAt: true,
          absoluteExpiresAt: true,
          mfaVerifiedAt: true,
          revokedAt: true,
        },
      });
    },

    async extend(id, expiresAt, seenAt) {
      await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { expiresAt, lastSeenAt: seenAt } });
    },

    async revoke(id, at) {
      await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });
    },

    async revokeAllForUser(userId, at) {
      const { count } = await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });
      return count;
    },
  };
}
