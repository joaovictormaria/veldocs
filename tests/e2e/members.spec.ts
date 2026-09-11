import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { headers, signupWithMfa } from "./support/session";

interface Member {
  userId: string;
  email: string;
  status: string;
  roleKeys: string[];
}

test("convite por link: cadastro do convidado, troca de perfil, suspensão e remoção", async ({ request, baseURL }) => {
  const owner = await signupWithMfa(request, "Empresa Membros E2E");
  const email = `convidado-${randomUUID().slice(0, 8)}@example.com`;

  const roles = await request.get("/api/company/roles");
  expect(roles.status()).toBe(200);
  expect(((await roles.json()).roles as Array<{ key: string }>).map((role) => role.key)).toEqual([
    "OWNER",
    "ADMIN",
    "GESTOR",
    "COLABORADOR",
    "VISUALIZADOR",
  ]);

  const created = await request.post("/api/company/invitations", {
    data: { email, roleKey: "COLABORADOR" },
    headers: headers(),
  });
  expect(created.status()).toBe(201);
  const { inviteUrl } = (await created.json()) as { inviteUrl: string };
  expect(new URL(inviteUrl).pathname).toMatch(/^\/convite\/[A-Za-z0-9_-]{43}$/);
  const token = new URL(inviteUrl).pathname.split("/").pop() as string;

  const pending = await request.get("/api/company/invitations");
  expect(((await pending.json()).invitations as Array<{ email: string }>).map((invitation) => invitation.email)).toContain(
    email,
  );

  const guest = await playwrightRequest.newContext({ baseURL });
  try {
    const preview = await guest.get(`/api/invitations/${token}`);
    expect(preview.status()).toBe(200);
    expect((await preview.json()).invitation).toMatchObject({
      companyName: "Empresa Membros E2E",
      roleName: "Colaborador",
      email: `${email.slice(0, 2)}***@example.com`,
    });

    const signup = await guest.post(`/api/invitations/${token}/signup`, {
      data: { name: "Pessoa Convidada", password: "uma frase longa e secreta" },
      headers: headers(),
    });
    expect(signup.status()).toBe(201);
    const { userId, companyId } = (await signup.json()) as { userId: string; companyId: string };
    expect(companyId).toBe(owner.companyId);

    expect((await guest.get("/api/company")).status()).toBe(200);

    const members = ((await (await request.get("/api/company/members")).json()).members as Member[]);
    expect(members.find((member) => member.userId === userId)).toMatchObject({
      email,
      status: "ACTIVE",
      roleKeys: ["COLABORADOR"],
    });

    const promoted = await request.put(`/api/company/members/${userId}/roles`, {
      data: { roleKeys: ["GESTOR"] },
      headers: headers(),
    });
    expect(promoted.status()).toBe(200);
    expect((await promoted.json()).member.roleKeys).toEqual(["GESTOR"]);

    const suspended = await request.put(`/api/company/members/${userId}/status`, {
      data: { status: "SUSPENDED" },
      headers: headers(),
    });
    expect(suspended.status()).toBe(200);
    expect((await guest.get("/api/company")).status()).toBe(403);

    await request.put(`/api/company/members/${userId}/status`, { data: { status: "ACTIVE" }, headers: headers() });
    expect((await guest.get("/api/company")).status()).toBe(200);

    const removed = await request.delete(`/api/company/members/${userId}`, { headers: headers() });
    expect(removed.status()).toBe(204);
    expect((await guest.get("/api/company")).status()).toBe(403);
    const remaining = ((await (await request.get("/api/company/members")).json()).members as Member[]);
    expect(remaining.map((member) => member.userId)).not.toContain(userId);

    expect((await guest.get(`/api/invitations/${token}`)).status()).toBe(404);
  } finally {
    await guest.dispose();
  }

  const self = await request.put(`/api/company/members/${owner.userId}/roles`, {
    data: { roleKeys: ["ADMIN"] },
    headers: headers(),
  });
  expect(self.status()).toBe(403);
  expect((await self.json()).error).toBe("cannot_modify_self");
});

test("convite revogado, inexistente ou aceito sem sessão é recusado", async ({ request, baseURL }) => {
  await signupWithMfa(request, "Empresa Convite Revogado E2E");

  const created = await request.post("/api/company/invitations", {
    data: { email: `revogado-${randomUUID().slice(0, 8)}@example.com`, roleKey: "GESTOR" },
    headers: headers(),
  });
  const { invitation, inviteUrl } = (await created.json()) as { invitation: { id: string }; inviteUrl: string };
  const token = new URL(inviteUrl).pathname.split("/").pop() as string;

  expect((await request.delete(`/api/company/invitations/${invitation.id}`, { headers: headers() })).status()).toBe(204);

  const anonymous = await playwrightRequest.newContext({ baseURL });
  try {
    expect((await anonymous.get(`/api/invitations/${token}`)).status()).toBe(404);
    expect((await anonymous.get(`/api/invitations/${"x".repeat(43)}`)).status()).toBe(404);

    const accept = await anonymous.post(`/api/invitations/${token}/accept`, { headers: headers() });
    expect(accept.status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
});

test("rotas de membros e convites exigem sessão e mesma origem", async ({ request }) => {
  for (const path of ["/api/company/roles", "/api/company/invitations"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect(
    (await request.post("/api/company/invitations", { data: { email: "a@example.com", roleKey: "GESTOR" }, headers: headers() })).status(),
  ).toBe(401);

  await signupWithMfa(request, "Empresa Origem Membros E2E");
  const withoutOrigin = await request.post("/api/company/invitations", {
    data: { email: "a@example.com", roleKey: "GESTOR" },
  });
  expect(withoutOrigin.status()).toBe(403);
  expect((await withoutOrigin.json()).error).toBe("forbidden_origin");
});
