import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/infrastructure/config/env";

/** Cria um PrismaClient para a URL informada (usado também pelos testes de integração). */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { veldocsPrisma?: PrismaClient };

/**
 * PrismaClient compartilhado da aplicação.
 * Criado sob demanda (não conecta durante o build) e reaproveitado entre
 * recarregamentos do dev server.
 */
export function getPrismaClient(): PrismaClient {
  globalForPrisma.veldocsPrisma ??= createPrismaClient(getEnv().DATABASE_URL);
  return globalForPrisma.veldocsPrisma;
}
