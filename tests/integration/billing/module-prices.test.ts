import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCatalogQueries } from "@/application/billing/catalog-queries";
import { KIT_CATALOG } from "@/domain/billing/kit-catalog";
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

/** Kits enviados pelo usuário em 2026-09-11 (R$/mês, em centavos). */
const PRECOS_KITS = {
  essencial: 6990,
  gestao: 12990,
  inteligencia: 19990,
  comunicacao: 11990,
  "controle-avancado": 16990,
  complete: 39990,
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
const queries = () => createCatalogQueries({ repository: repository(), now: () => now });

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
  it("só o Core: R$ 49,90, sem sugestão de kit", async () => {
    await expect(queries().quote([])).resolves.toEqual({
      modules: ["core"],
      totalCents: 4990,
      unpriced: [],
      unknown: [],
      suggestion: null,
    });
  });

  it("Core + Controle de vencimentos + WhatsApp: R$ 129,70", async () => {
    const quote = await queries().quote(["vencimentos", "whatsapp"]);

    expect(quote.modules).toEqual(["core", "vencimentos", "whatsapp"]);
    expect(quote.totalCents).toBe(12970);
  });

  it("chave inexistente é apontada e não entra no total", async () => {
    const quote = await queries().quote(["modulo-inventado"]);

    expect(quote.unknown).toEqual(["modulo-inventado"]);
    expect(quote.totalCents).toBe(4990);
  });
});

describe("kits no banco", () => {
  it("os kits da migração correspondem ao domínio, com os preços da tabela do usuário", async () => {
    const kits = await repository().listKits(now);

    expect(kits.map(({ key, name, audience, modules }) => ({ key, name, audience, modules }))).toEqual(
      KIT_CATALOG.map(({ key, name, audience, modules }) => ({ key, name, audience, modules: [...modules] })),
    );
    expect(Object.fromEntries(kits.map((kit) => [kit.key, kit.monthlyPriceCents]))).toEqual(PRECOS_KITS);
    expect(new Set(kits.map((kit) => kit.currency))).toEqual(new Set(["BRL"]));
  });

  it("a limpeza entre testes não apaga kits nem seus preços", async () => {
    await truncateAllTables(prisma);

    expect(await prisma.kit.count()).toBe(KIT_CATALOG.length);
    expect(await prisma.kitPrice.count()).toBe(KIT_CATALOG.length);
  });

  it("o banco recusa kit com módulo fora do catálogo e preço de kit negativo", async () => {
    await expect(
      prisma.kitModule.create({ data: { kitKey: "essencial", moduleKey: "modulo-inventado" } }),
    ).rejects.toThrow();
    await expect(
      prisma.kitPrice.create({ data: { kitKey: "essencial", amountCents: -1, validFrom: now } }),
    ).rejects.toThrow();

    expect(await prisma.kitPrice.count()).toBe(KIT_CATALOG.length);
  });
});

describe("kits no orçamento (DEC-024)", () => {
  it("kit + módulo avulso: Gestão + Contratos = R$ 169,80, sem cobrar de novo o que está no kit", async () => {
    const quote = await queries().quoteKit("gestao", ["contratos", "vencimentos"]);

    expect(quote).toMatchObject({ kitCents: 12990, extras: ["contratos"], extrasCents: 3990, totalCents: 16980 });
  });

  it("sugere o Gestão para os mesmos módulos avulsos: R$ 159,50 → R$ 129,90", async () => {
    const quote = await queries().quote(["vencimentos", "funcionarios", "fornecedores", "solicitacoes"]);

    expect(quote.totalCents).toBe(15950);
    expect(quote.suggestion).toEqual({ kitKey: "gestao", totalCents: 12990, savingsCents: 2960 });
  });

  it("sugere kit com módulo a mais quando fica mais barato: Inteligência sem o Radar, R$ 219,50 → R$ 199,90", async () => {
    const quote = await queries().quote(["analise-documentos", "assistente-ia", "ocr", "score-documental"]);

    expect(quote.totalCents).toBe(21950);
    expect(quote.suggestion).toEqual({ kitKey: "inteligencia", totalCents: 19990, savingsCents: 1960 });
  });

  it("todos os módulos: sugere o Complete, com economia de R$ 238,40", async () => {
    const quote = await queries().quote([...MODULE_KEYS]);

    expect(quote.totalCents).toBe(63830);
    expect(quote.suggestion).toEqual({ kitKey: "complete", totalCents: 39990, savingsCents: 23840 });
  });

  it("Core + Vencimentos não sugere o Essencial, que o usuário manteve R$ 0,10 acima do avulso", async () => {
    const individual = await queries().quote(["vencimentos"]);
    const essencial = await queries().quoteKit("essencial", []);

    expect(individual.totalCents).toBe(6980);
    expect(essencial?.totalCents).toBe(6990);
    expect(individual.suggestion).toBeNull();
  });

  it("kit inexistente não gera orçamento", async () => {
    await expect(queries().quoteKit("kit-inventado", [])).resolves.toBeNull();
  });
});
