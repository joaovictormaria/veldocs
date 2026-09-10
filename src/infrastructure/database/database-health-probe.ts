import type { HealthProbe } from "@/application/ports/health-probe";
import type { PrismaClient } from "@/generated/prisma/client";

export function createDatabaseHealthProbe(prisma: PrismaClient): HealthProbe {
  return {
    name: "database",
    async check() {
      await prisma.$queryRaw`SELECT 1`;
    },
  };
}
