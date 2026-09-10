import { NextResponse } from "next/server";
import { checkHealth } from "@/application/system/check-health";
import { createDatabaseHealthProbe } from "@/infrastructure/database/database-health-probe";
import { createMigrationsHealthProbe } from "@/infrastructure/database/migrations-health-probe";
import { getPrismaClient } from "@/infrastructure/database/prisma-client";

export async function GET() {
  const prisma = getPrismaClient();
  const report = await checkHealth([
    createDatabaseHealthProbe(prisma),
    createMigrationsHealthProbe(prisma),
  ]);

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
