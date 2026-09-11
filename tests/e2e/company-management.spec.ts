import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { headers, signupWithMfa } from "./support/session";

interface Branch {
  id: string;
  name: string;
  code: string | null;
}

interface Department {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
}

test("dados da empresa podem ser editados pelo OWNER", async ({ request }) => {
  const owner = await signupWithMfa(request, "Empresa Cadastro E2E");

  const updated = await request.patch("/api/company", {
    data: { name: "Empresa Cadastro Renomeada", legalName: "Cadastro LTDA", taxId: "12.345.678/0001-95" },
    headers: headers(),
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).company).toMatchObject({
    id: owner.companyId,
    name: "Empresa Cadastro Renomeada",
    taxId: "12345678000195",
  });

  const reread = await request.get("/api/company");
  expect((await reread.json()).company.name).toBe("Empresa Cadastro Renomeada");
});

test("CNPJ inválido é recusado com o campo apontado", async ({ request }) => {
  await signupWithMfa(request, "Empresa CNPJ E2E");

  const response = await request.patch("/api/company", {
    data: { name: "Empresa CNPJ", taxId: "12345678000196" },
    headers: headers(),
  });

  expect(response.status()).toBe(400);
  const body = (await response.json()) as { error: string; issues: Array<{ field: string }> };
  expect(body.error).toBe("invalid_input");
  expect(body.issues.map((issue) => issue.field)).toContain("taxId");
});

test("ciclo completo de filiais e setores", async ({ request }) => {
  await signupWithMfa(request, "Empresa Estrutura E2E");

  const created = await request.post("/api/company/branches", {
    data: { name: "Matriz", code: "MTZ" },
    headers: headers(),
  });
  expect(created.status()).toBe(201);
  const branch = (await created.json()).branch as Branch;

  const duplicated = await request.post("/api/company/branches", {
    data: { name: "Outra", code: "MTZ" },
    headers: headers(),
  });
  expect(duplicated.status()).toBe(409);
  expect((await duplicated.json()).error).toBe("conflict");

  const department = await request.post("/api/company/departments", {
    data: { name: "Financeiro", branchId: branch.id },
    headers: headers(),
  });
  expect(department.status()).toBe(201);
  const newDepartment = (await department.json()).department as Department;
  expect(newDepartment.branchName).toBe("Matriz");

  // Filial com setor ativo não pode ser excluída.
  const blocked = await request.delete(`/api/company/branches/${branch.id}`, { headers: headers() });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error).toBe("resource_in_use");

  expect((await request.delete(`/api/company/departments/${newDepartment.id}`, { headers: headers() })).status()).toBe(204);
  expect((await request.delete(`/api/company/branches/${branch.id}`, { headers: headers() })).status()).toBe(204);

  const remaining = await request.get("/api/company/branches");
  expect(((await remaining.json()).branches as Branch[]).map((item) => item.id)).not.toContain(branch.id);
});

test("setor aceita filial da própria empresa apenas", async ({ request, baseURL }) => {
  await signupWithMfa(request, "Empresa Dona E2E");
  const created = await request.post("/api/company/branches", {
    data: { name: "Matriz Dona", code: "DON" },
    headers: headers(),
  });
  const branch = (await created.json()).branch as Branch;

  const intruder = await playwrightRequest.newContext({ baseURL });
  try {
    await signupWithMfa(intruder, "Empresa Intrusa E2E");

    const response = await intruder.post("/api/company/departments", {
      data: { name: "Financeiro", branchId: branch.id },
      headers: headers(),
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).issues).toEqual([{ field: "branchId", message: "filial não encontrada" }]);

    for (const path of [`/api/company/branches/${branch.id}`]) {
      expect((await intruder.get(path)).status(), path).toBe(404);
      expect((await intruder.patch(path, { data: { name: "Invadida" }, headers: headers() })).status(), path).toBe(404);
      expect((await intruder.delete(path, { headers: headers() })).status(), path).toBe(404);
    }

    // A filial segue intacta para a dona.
    const untouched = await request.get(`/api/company/branches/${branch.id}`);
    expect(((await untouched.json()).branch as Branch).name).toBe("Matriz Dona");
  } finally {
    await intruder.dispose();
  }
});

test("escritas exigem sessão e mesma origem", async ({ request }) => {
  const paths = ["/api/company/branches", "/api/company/departments"];

  for (const path of paths) {
    const unauthenticated = await request.post(path, { data: { name: "Qualquer" }, headers: headers() });
    expect(unauthenticated.status(), path).toBe(401);

    const listing = await request.get(path);
    expect(listing.status(), path).toBe(401);
  }

  await signupWithMfa(request, "Empresa Origem E2E");

  for (const path of paths) {
    // Sem Origin, o cookie SameSite=Lax não basta: a escrita é recusada.
    const foreignOrigin = await request.post(path, { data: { name: "Sem origem" } });
    expect(foreignOrigin.status(), path).toBe(403);
    expect((await foreignOrigin.json()).error).toBe("forbidden_origin");
  }
});

test("ids inválidos ou inexistentes respondem 404", async ({ request }) => {
  await signupWithMfa(request, "Empresa Ids E2E");

  for (const base of ["/api/company/branches", "/api/company/departments"]) {
    for (const id of [randomUUID(), "nao-e-uuid", "..%2F..%2Fetc"]) {
      const path = `${base}/${id}`;
      expect((await request.get(path)).status(), path).toBe(404);
      expect((await request.delete(path, { headers: headers() })).status(), path).toBe(404);
    }
  }
});
