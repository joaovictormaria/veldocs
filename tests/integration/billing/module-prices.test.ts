import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCatalogQueries } from "@/application/billing/catalog-queries";
import { MODULE_KEYS } from "@/domain/billing/module-catalog";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaBillingCatalogRepository } from "@/infrastructure/database/prisma-billing-catalog-repository";
import { createTestPrismaClient, truncateAllTables } from "../support/database";

/** Tabela enviada pelo usuário em 2026-09-11 (R$/mês, em centavos). */
const PRECOS_INICIAIS = {
  core: 4990,
  vencimentos: 1990,
  funcionarios: 2990,
  fornecedores: 2990,
  contratos: 3990,
  solicitacoes: 2990,
  aprovacoes: 1990,
  automacao: 3990,
  "analise-documentos": 5990,
  "assistente-ia": 3990,
  whatsapp: 5990,
  "portal-terceiros": 3990,
  "relatorios-avancados": 2990,
  ocr: 3990,
  "score-documental": 2990,
  "radar-risco": 3990,
  "modo-auditoria": 3990,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const now = new Date("2026-09-11T12:00:00.000Z");

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const repository = () => createPrismaBillingCatalogRepository(prisma);

const priceOf = async (key: string, at: Date) =>
  (await repository().listCatalog(at)).find((entry) => entry.key === key)?.monthlyPriceCents;

describe("preços iniciais dos módulos", () => {
  it("todo módulo do catálogo tem o preço mensal da tabela do usuário, em reais", async () => {
    const catalog = await repository().listCatalog(now);

    expect(catalog.map((entry) => entry.key)).toEqual([...MODULE_KEYS]);
    expect(Object.fromEntries(catalog.map((entry) => [entry.key, entry.monthlyPriceCents]))).toEqual(PRECOS_INICIAIS);
    expect(new Set(catalog.map((entry) => entry.currency))).toEqual(new Set(["BRL"]));
  });

  it("antes do início da vigência nenhum preço vale", async () => {
    const catalog = await repository().listCatalog(new Date("2026-09-10T12:00:00.000Z"));
    expect(catalog.every((entry) => entry.monthlyPriceCents === null)).toBe(true);
  });

  it("preço com vigência futura só passa a valer na data", async () => {
    const future = await prisma.modulePrice.create({
      data: { moduleKey: "vencimentos", amountCents: 2490, validFrom: new Date(now.getTime() + 10 * DAY) },
    });
    try {
      await expect(priceOf("vencimentos", now)).resolves.toBe(1990);
      await expect(priceOf("vencimentos", new Date(now.getTime() + 11 * DAY))).resolves.toBe(2490);
    } finally {
      await prisma.modulePrice.delete({ where: { id: future.id } });
    }
  });

  it("preço encerrado deixa de valer, mesmo sendo o de início mais recente", async () => {
    const closed = await prisma.modulePrice.create({
      data: {
        moduleKey: "vencimentos",
        amountCents: 999,
        validFrom: new Date(now.getTime() - 60 * MINUTE),
        validUntil: new Date(now.getTime() - MINUTE),
      },
    });
    try {
      await expect(priceOf("vencimentos", now)).resolves.toBe(1990);
    } finally {
      await prisma.modulePrice.delete({ where: { id: closed.id } });
    }
  });

  it("o banco recusa preço negativo, vigência invertida e moeda fora do padrão", async () => {
    await expect(
      prisma.modulePrice.create({ data: { moduleKey: "core", amountCents: -1, validFrom: now } }),
    ).rejects.toThrow();
    await expect(
      prisma.modulePrice.create({ data: { moduleKey: "core", amountCents: 100, validFrom: now, validUntil: now } }),
    ).rejects.toThrow();
    await expect(
      prisma.modulePrice.create({ data: { moduleKey: "core", amountCents: 100, currency: "brl", validFrom: now } }),
    ).rejects.toThrow();

    expect(await prisma.modulePrice.count()).toBe(MODULE_KEYS.length);
  });
});

describe("orçamento mensal com os preços reais", () => {
  const quotes = () => createCatalogQueries({ repository: repository(), now: () => now });

  it("só o Core: R$ 49,90", async () => {
    await expect(quotes().quote([])).resolves.toEqual({
      modules: ["core"],
      totalCents: 4990,
      unpriced: [],
      unknown: [],
    });
  });

  it("Core + Controle de vencimentos + WhatsApp: R$ 129,70", async () => {
    const quote = await quotes().quote(["vencimentos", "whatsapp"]);

    expect(quote.modules).toEqual(["core", "vencimentos", "whatsapp"]);
    expect(quote.totalCents).toBe(12970);
  });

  it("todos os 17 módulos: R$ 638,30", async () => {
    const quote = await quotes().quote([...MODULE_KEYS]);

    expect(quote.totalCents).toBe(63830);
    expect(quote.unpriced).toEqual([]);
  });

  it("chave inexistente é apontada e não entra no total", async () => {
    const quote = await quotes().quote(["modulo-inventado"]);

    expect(quote.unknown).toEqual(["modulo-inventado"]);
    expect(quote.totalCents).toBe(4990);
  });
});
