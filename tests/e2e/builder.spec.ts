import { expect, test } from "@playwright/test";
import { headers, signupWithMfa } from "./support/session";

interface CatalogEntry {
  key: string;
  monthlyPriceCents: number | null;
}

test("Builder: catálogo, preço em tempo real, sugestão de kit e início do trial", async ({ request }) => {
  await signupWithMfa(request, "Empresa Builder E2E");

  const before = await request.get("/api/subscription");
  expect(before.status()).toBe(200);
  expect((await before.json()).subscription).toMatchObject({
    status: "NOT_STARTED",
    hasAccess: true,
    monthlyTotalCents: null,
  });

  const catalog = await request.get("/api/builder/catalog");
  expect(catalog.status()).toBe(200);
  const { modules, kits, trialDays, currency } = (await catalog.json()) as {
    modules: CatalogEntry[];
    kits: CatalogEntry[];
    trialDays: number;
    currency: string;
  };
  expect(modules).toHaveLength(17);
  expect(kits).toHaveLength(6);
  expect(trialDays).toBe(14);
  expect(currency).toBe("BRL");
  expect(modules.find((entry) => entry.key === "core")?.monthlyPriceCents).toBe(4990);
  expect(kits.find((entry) => entry.key === "complete")?.monthlyPriceCents).toBe(39990);

  const individual = await request.get("/api/builder/quote?modules=vencimentos,funcionarios,fornecedores,solicitacoes");
  expect(individual.status()).toBe(200);
  expect(await individual.json()).toMatchObject({
    kind: "modules",
    quote: { totalCents: 15950, suggestion: { kitKey: "gestao", totalCents: 12990, savingsCents: 2960 } },
  });

  const withKit = await request.get("/api/builder/quote?kit=gestao&modules=contratos");
  expect(await withKit.json()).toMatchObject({ kind: "kit", quote: { totalCents: 16980, extras: ["contratos"] } });

  const started = await request.post("/api/builder/trial", {
    data: { kitKey: "gestao", modules: ["contratos"] },
    headers: headers(),
  });
  expect(started.status()).toBe(201);
  expect((await started.json()).subscription).toMatchObject({
    status: "TRIAL_ACTIVE",
    hasAccess: true,
    kit: { key: "gestao", name: "Gestão" },
    trial: { daysRemaining: 14 },
    monthlyTotalCents: 16980,
  });

  const again = await request.post("/api/builder/trial", { data: { modules: [] }, headers: headers() });
  expect(again.status()).toBe(409);
  expect((await again.json()).error).toBe("trial_already_started");

  const after = await request.get("/api/subscription");
  expect(((await after.json()).subscription.modules as CatalogEntry[]).map((entry) => entry.key)).toEqual([
    "core",
    "vencimentos",
    "funcionarios",
    "fornecedores",
    "contratos",
    "solicitacoes",
  ]);
});

test("Builder recusa escolha inválida sem iniciar o trial", async ({ request }) => {
  await signupWithMfa(request, "Empresa Builder Inválida E2E");

  const invalid = await request.post("/api/builder/trial", {
    data: { kitKey: "kit-inventado", modules: ["modulo-inventado"] },
    headers: headers(),
  });
  expect(invalid.status()).toBe(400);
  const { issues } = (await invalid.json()) as { issues: Array<{ field: string }> };
  expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["kitKey", "modules"]));

  expect((await (await request.get("/api/subscription")).json()).subscription.status).toBe("NOT_STARTED");
  expect((await request.get("/api/builder/quote?kit=kit-inventado")).status()).toBe(400);
});

test("rotas do Builder exigem sessão e mesma origem", async ({ request }) => {
  for (const path of ["/api/builder/catalog", "/api/builder/quote", "/api/subscription"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
  expect((await request.post("/api/builder/trial", { data: { modules: [] }, headers: headers() })).status()).toBe(401);

  await signupWithMfa(request, "Empresa Builder Origem E2E");

  const withoutOrigin = await request.post("/api/builder/trial", { data: { modules: [] } });
  expect(withoutOrigin.status()).toBe(403);
  expect((await withoutOrigin.json()).error).toBe("forbidden_origin");
});
