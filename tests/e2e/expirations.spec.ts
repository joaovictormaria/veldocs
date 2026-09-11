import { expect, test } from "@playwright/test";
import { headers, signupWithMfa } from "./support/session";

interface Documento {
  id: string;
  title: string;
  expirationDate: string | null;
  expirationStatus?: string;
}

interface Painel {
  today: string;
  windowDays: number;
  counts: { valid: number; expiring: number; expired: number; withoutExpiration: number; total: number };
  upcoming: Array<Documento & { daysRemaining: number }>;
}

/** Data de calendário a partir de hoje, para o teste não depender do dia em que roda. */
const emDias = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

test("vencimentos são capacidade do módulo: sem ele, 403; com ele, painel e filtros", async ({ request }) => {
  await signupWithMfa(request, "Empresa Vencimentos E2E");

  // Empresa recém-criada usa só o Core: o módulo pago não responde.
  const semModulo = await request.get("/api/expirations");
  expect(semModulo.status()).toBe(403);
  expect((await semModulo.json()).error).toBe("module_not_enabled");

  const filtroSemModulo = await request.get("/api/documents?status=EXPIRED");
  expect(filtroSemModulo.status()).toBe(403);
  expect((await filtroSemModulo.json()).error).toBe("module_not_enabled");

  // A lista comum continua funcionando, só que sem situação de vencimento.
  const listaSemModulo = await request.get("/api/documents");
  expect(listaSemModulo.status()).toBe(200);

  const trial = await request.post("/api/builder/trial", {
    data: { modules: ["vencimentos"] },
    headers: headers(),
  });
  expect(trial.status()).toBe(201);

  const documentos: Array<[string, string | null]> = [
    ["Alvará vencido", emDias(-10)],
    ["Certidão vencendo", emDias(5)],
    ["Apólice válida", emDias(200)],
    ["Manual interno", null],
  ];
  const criados: Record<string, Documento> = {};
  for (const [title, expirationDate] of documentos) {
    const response = await request.post("/api/documents", {
      data: { title, expirationDate },
      headers: headers(),
    });
    expect(response.status()).toBe(201);
    criados[title] = (await response.json()).document as Documento;
  }

  const painelResposta = await request.get("/api/expirations");
  expect(painelResposta.status()).toBe(200);
  const painel = (await painelResposta.json()) as Painel;
  expect(painel).toMatchObject({
    windowDays: 30,
    counts: { valid: 1, expiring: 1, expired: 1, withoutExpiration: 1, total: 4 },
  });
  expect(painel.upcoming.map((item) => item.title)).toEqual(["Alvará vencido", "Certidão vencendo"]);
  expect(painel.upcoming[0]?.daysRemaining).toBe(-10);

  // Com o módulo, a listagem traz a situação e aceita o filtro.
  const vencidos = await request.get("/api/documents?status=EXPIRED&sort=expiration");
  expect(vencidos.status()).toBe(200);
  const listaVencidos = (await vencidos.json()) as { items: Documento[]; total: number };
  expect(listaVencidos.total).toBe(1);
  expect(listaVencidos.items[0]).toMatchObject({ title: "Alvará vencido", expirationStatus: "EXPIRED" });

  const semValidade = await request.get("/api/documents?status=NO_EXPIRATION");
  expect(((await semValidade.json()) as { items: Documento[] }).items[0]?.title).toBe("Manual interno");
});

test("renovação avança a validade e recusa andar para trás", async ({ request }) => {
  await signupWithMfa(request, "Empresa Renovação E2E");
  await request.post("/api/builder/trial", { data: { modules: ["vencimentos"] }, headers: headers() });

  const criado = await request.post("/api/documents", {
    data: { title: "Certidão Negativa", issueDate: emDias(-365), expirationDate: emDias(-1) },
    headers: headers(),
  });
  const documento = (await criado.json()).document as Documento;

  const renovado = await request.post(`/api/documents/${documento.id}/renew`, {
    data: { issueDate: emDias(0), expirationDate: emDias(365) },
    headers: headers(),
  });
  expect(renovado.status()).toBe(200);
  expect((await renovado.json()).document).toMatchObject({
    title: "Certidão Negativa",
    issueDate: emDias(0),
    expirationDate: emDias(365),
  });

  const paraTras = await request.post(`/api/documents/${documento.id}/renew`, {
    data: { expirationDate: emDias(30) },
    headers: headers(),
  });
  expect(paraTras.status()).toBe(400);
  expect((await paraTras.json()).issues).toEqual([
    { field: "expirationDate", message: "a nova validade precisa ser posterior à atual" },
  ]);

  // Depois de renovar, o documento sai dos alertas.
  const painel = (await (await request.get("/api/expirations")).json()) as Painel;
  expect(painel.counts).toMatchObject({ valid: 1, expired: 0 });
  expect(painel.upcoming).toEqual([]);
});

test("rotas de vencimento exigem sessão, mesma origem e id válido", async ({ request }) => {
  expect((await request.get("/api/expirations")).status()).toBe(401);

  await signupWithMfa(request, "Empresa Origem Vencimentos E2E");
  await request.post("/api/builder/trial", { data: { modules: ["vencimentos"] }, headers: headers() });

  const criado = await request.post("/api/documents", {
    data: { title: "Documento", expirationDate: emDias(10) },
    headers: headers(),
  });
  const documento = (await criado.json()).document as Documento;

  const semOrigem = await request.post(`/api/documents/${documento.id}/renew`, {
    data: { expirationDate: emDias(400) },
  });
  expect(semOrigem.status()).toBe(403);

  const idInvalido = await request.post("/api/documents/nao-e-uuid/renew", {
    data: { expirationDate: emDias(400) },
    headers: headers(),
  });
  expect(idInvalido.status()).toBe(404);
});
