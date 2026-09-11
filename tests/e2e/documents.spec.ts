import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { headers, signupWithMfa } from "./support/session";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  path: string[];
  depth: number;
  documentCount: number;
}

interface Document {
  id: string;
  title: string;
  category: { id: string; name: string } | null;
  responsible: { userId: string; name: string } | null;
  createdBy: { userId: string; name: string } | null;
  issueDate: string | null;
  expirationDate: string | null;
  tags: string[];
}

interface Listing {
  items: Document[];
  total: number;
  page: number;
  pageSize: number;
}

test("ciclo completo de categorias, documentos e etiquetas", async ({ request }) => {
  const owner = await signupWithMfa(request, "Empresa Documentos E2E");

  const createdCategory = await request.post("/api/categories", {
    data: { name: "Pessoal" },
    headers: headers(),
  });
  expect(createdCategory.status()).toBe(201);
  const pessoal = (await createdCategory.json()).category as Category;

  const createdSubcategory = await request.post("/api/categories", {
    data: { name: "Admissão", parentId: pessoal.id },
    headers: headers(),
  });
  expect(createdSubcategory.status()).toBe(201);
  const admissao = (await createdSubcategory.json()).category as Category;

  const createdDocument = await request.post("/api/documents", {
    data: {
      title: "Ficha de Admissão",
      description: "Documentação do funcionário",
      categoryId: admissao.id,
      responsibleUserId: owner.userId,
      issueDate: "2026-02-01",
      expirationDate: "2027-02-01",
      tags: ["Pessoal", "pessoal", "Urgente"],
    },
    headers: headers(),
  });
  expect(createdDocument.status()).toBe(201);
  const document = (await createdDocument.json()).document as Document;
  expect(document).toMatchObject({
    category: { id: admissao.id, name: "Admissão" },
    responsible: { userId: owner.userId },
    createdBy: { userId: owner.userId },
    issueDate: "2026-02-01",
    expirationDate: "2027-02-01",
    tags: ["Pessoal", "Urgente"],
  });

  // Busca sem acento e filtro pela categoria-mãe alcançam o documento.
  const found = await request.get("/api/documents?q=admissao&categoryId=" + pessoal.id);
  expect(found.status()).toBe(200);
  const listing = (await found.json()) as Listing;
  expect(listing).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  expect(listing.items[0]?.id).toBe(document.id);

  const tags = await request.get("/api/tags");
  expect((await tags.json()).tags).toEqual([
    { name: "Pessoal", documentCount: 1 },
    { name: "Urgente", documentCount: 1 },
  ]);

  const updated = await request.patch(`/api/documents/${document.id}`, {
    data: { title: "Ficha de Admissão revisada", categoryId: admissao.id, tags: ["Urgente"] },
    headers: headers(),
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).document).toMatchObject({ title: "Ficha de Admissão revisada", tags: ["Urgente"] });

  // A categoria com documento não pode ser excluída.
  const blocked = await request.delete(`/api/categories/${admissao.id}`, { headers: headers() });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error).toBe("resource_in_use");

  expect((await request.delete(`/api/documents/${document.id}`, { headers: headers() })).status()).toBe(204);
  expect((await request.get(`/api/documents/${document.id}`)).status()).toBe(404);
  expect((await request.delete(`/api/categories/${admissao.id}`, { headers: headers() })).status()).toBe(204);

  const categories = await request.get("/api/categories");
  expect(((await categories.json()).categories as Category[]).map((item) => item.name)).toEqual(["Pessoal"]);
});

test("validações do documento respondem com o campo do formulário", async ({ request }) => {
  await signupWithMfa(request, "Empresa Validação E2E");

  const invalid = await request.post("/api/documents", {
    data: { title: "A", issueDate: "2026-05-10", expirationDate: "2026-05-09" },
    headers: headers(),
  });
  expect(invalid.status()).toBe(400);
  const body = (await invalid.json()) as { error: string; issues: Array<{ field: string }> };
  expect(body.error).toBe("invalid_input");
  expect(body.issues.map((issue) => issue.field).sort()).toEqual(["expirationDate", "title"]);

  const unknownCategory = await request.post("/api/documents", {
    data: { title: "Contrato", categoryId: randomUUID() },
    headers: headers(),
  });
  expect(unknownCategory.status()).toBe(400);
  expect((await unknownCategory.json()).issues).toEqual([{ field: "categoryId", message: "categoria não encontrada" }]);

  const badQuery = await request.get("/api/documents?page=0&sort=aleatorio");
  expect(badQuery.status()).toBe(400);
});

test("documentos e categorias de outra empresa não são alcançáveis", async ({ request, baseURL }) => {
  await signupWithMfa(request, "Empresa Dona Documentos E2E");
  const category = (
    await (await request.post("/api/categories", { data: { name: "Sigilosos" }, headers: headers() })).json()
  ).category as Category;
  const document = (
    await (
      await request.post("/api/documents", {
        data: { title: "Contrato sigiloso", categoryId: category.id },
        headers: headers(),
      })
    ).json()
  ).document as Document;

  const intruder = await playwrightRequest.newContext({ baseURL });
  try {
    await signupWithMfa(intruder, "Empresa Intrusa Documentos E2E");

    for (const path of [`/api/documents/${document.id}`, `/api/categories/${category.id}`]) {
      expect((await intruder.get(path)).status(), path).toBe(404);
      // Corpo válido de propósito: o 404 tem de vir de "não é da sua empresa".
      const body = { name: "Invadida", title: "Invadido" };
      expect((await intruder.patch(path, { data: body, headers: headers() })).status(), path).toBe(404);
      expect((await intruder.delete(path, { headers: headers() })).status(), path).toBe(404);
    }

    // Nem como referência de um documento novo.
    const borrowed = await intruder.post("/api/documents", {
      data: { title: "Tentativa", categoryId: category.id },
      headers: headers(),
    });
    expect(borrowed.status()).toBe(400);

    const listing = (await (await intruder.get("/api/documents")).json()) as Listing;
    expect(listing.items).toEqual([]);

    // O documento da dona segue intacto.
    expect(((await (await request.get(`/api/documents/${document.id}`)).json()).document as Document).title).toBe(
      "Contrato sigiloso",
    );
  } finally {
    await intruder.dispose();
  }
});

test("rotas de documentos exigem sessão e mesma origem", async ({ request }) => {
  for (const path of ["/api/documents", "/api/categories", "/api/tags"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.post("/api/documents", { data: { title: "Sem sessão" }, headers: headers() })).status()).toBe(401);

  await signupWithMfa(request, "Empresa Origem Documentos E2E");

  for (const path of ["/api/documents", "/api/categories"]) {
    const foreignOrigin = await request.post(path, { data: { title: "Sem origem", name: "Sem origem" } });
    expect(foreignOrigin.status(), path).toBe(403);
    expect((await foreignOrigin.json()).error).toBe("forbidden_origin");
  }
});

test("ids inválidos ou inexistentes respondem 404", async ({ request }) => {
  await signupWithMfa(request, "Empresa Ids Documentos E2E");

  for (const base of ["/api/documents", "/api/categories"]) {
    for (const id of [randomUUID(), "nao-e-uuid", "..%2F..%2Fetc"]) {
      const path = `${base}/${id}`;
      expect((await request.get(path)).status(), path).toBe(404);
      expect((await request.delete(path, { headers: headers() })).status(), path).toBe(404);
    }
  }
});
