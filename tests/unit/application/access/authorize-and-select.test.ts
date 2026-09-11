import { describe, expect, it } from "vitest";
import { createAuthorizer } from "@/application/access/authorize";
import { createCompanyQueries } from "@/application/access/company-queries";
import { createSelectActiveCompany } from "@/application/access/select-active-company";
import { createSessionManager } from "@/application/auth/session-manager";
import type { CompanyDirectory, EntitlementCheck } from "@/application/ports/access-control";
import {
  createFakeAccess,
  createFakeAudit,
  createFakeClock,
  createFakeEntitlements,
  createFakeIdentity,
  createFakeMfa,
  createFakeTokens,
  createInMemorySessions,
} from "../auth/fakes";

const COMPANY_A = "0192d7a0-0000-7000-8000-00000000000a";
const COMPANY_B = "0192d7a0-0000-7000-8000-00000000000b";
const context = { ipAddress: "203.0.113.10", userAgent: "teste" };

async function setup(
  options: {
    activeCompanyId?: string | null;
    entitlement?: EntitlementCheck;
    mfa?: { confirmed?: boolean; secret?: string };
  } = {},
) {
  const clock = createFakeClock();
  const identity = createFakeIdentity();
  const user = identity.addUser({ email: "maria@example.com", password: "uma frase longa e secreta" });
  const store = createInMemorySessions();
  const sessions = createSessionManager({ sessions: store.repository, tokens: createFakeTokens(), now: clock.now });
  const access = createFakeAccess();
  const entitlements = createFakeEntitlements(options.entitlement ?? "enabled");
  const mfa = createFakeMfa(options.mfa ?? {});
  const { audit, events } = createFakeAudit();

  const issued = await sessions.issue({
    userId: user.userId,
    activeCompanyId: options.activeCompanyId === undefined ? COMPANY_A : options.activeCompanyId,
    ...context,
  });

  return {
    user,
    identity,
    access,
    entitlements,
    events,
    store,
    sessions,
    clock,
    token: issued.token,
    authorize: createAuthorizer({
      sessions,
      identity: identity.identity,
      access: access.repository,
      entitlements: entitlements.service,
      mfa: mfa.repository,
    }),
    selectActiveCompany: createSelectActiveCompany({
      sessions,
      identity: identity.identity,
      access: access.repository,
      audit,
    }),
  };
}

describe("authorize", () => {
  it("autoriza com vínculo ativo, permissão do perfil e módulo ativo, usando a empresa da sessão", async () => {
    const { authorize, access, entitlements, user, token } = await setup();
    access.grant(user.userId, COMPANY_A, { roleKeys: ["GESTOR"], permissions: ["company.read"] });

    await expect(authorize(token, "company.read")).resolves.toEqual({
      ok: true,
      context: { companyId: COMPANY_A, userId: user.userId, roleKeys: ["GESTOR"], permissions: ["company.read"] },
    });
    expect(entitlements.checks).toEqual([`${COMPANY_A}:core`]);
  });

  it("recusa sem sessão válida ou com pessoa desativada", async () => {
    const { authorize, identity, token } = await setup();

    await expect(authorize(undefined, "company.read")).resolves.toEqual({ ok: false, reason: "unauthenticated" });
    await expect(authorize("tok_99999999", "company.read")).resolves.toEqual({ ok: false, reason: "unauthenticated" });

    identity.users.splice(0, 1, { ...identity.users[0]!, status: "DISABLED" });
    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("exige empresa ativa na sessão", async () => {
    const { authorize, access, token } = await setup({ activeCompanyId: null });

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "active_company_required" });
    expect(access.lookups).toHaveLength(0);
  });

  it.each([
    ["sem vínculo", null],
    ["vínculo suspenso", { membershipStatus: "SUSPENDED" as const }],
    ["vínculo apenas convidado", { membershipStatus: "INVITED" as const }],
    ["empresa suspensa", { companyActive: false }],
  ])("recusa com %s", async (_label, grant) => {
    const { authorize, access, entitlements, user, token } = await setup();
    if (grant) access.grant(user.userId, COMPANY_A, grant);

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
    expect(entitlements.checks).toHaveLength(0);
  });

  it("recusa quando o perfil não tem a permissão, sem consultar o entitlement", async () => {
    const { authorize, access, entitlements, user, token } = await setup();
    access.grant(user.userId, COMPANY_A, { roleKeys: ["VISUALIZADOR"], permissions: ["company.read"] });

    await expect(authorize(token, "members.read")).resolves.toEqual({ ok: false, reason: "forbidden" });
    expect(entitlements.checks).toHaveLength(0);
  });

  it("recusa quando o módulo da permissão não está ativo para a empresa", async () => {
    const { authorize, access, user, token } = await setup({ entitlement: "module_not_enabled" });
    access.grant(user.userId, COMPANY_A);

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "module_not_enabled" });
  });

  it("recusa com motivo próprio quando a assinatura da empresa não está válida", async () => {
    const { authorize, access, entitlements, user, token } = await setup({ entitlement: "subscription_inactive" });
    access.grant(user.userId, COMPANY_A);

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "subscription_inactive" });
    expect(entitlements.checks).toEqual([`${COMPANY_A}:core`]);
  });

  it("permissões de assinatura seguem valendo com a assinatura inválida, para a empresa poder assinar", async () => {
    const { authorize, access, entitlements, user, token } = await setup({ entitlement: "subscription_inactive" });
    access.grant(user.userId, COMPANY_A, { roleKeys: ["GESTOR"], permissions: ["billing.read", "company.read"] });

    await expect(authorize(token, "billing.read")).resolves.toMatchObject({ ok: true });
    expect(entitlements.checks).toHaveLength(0);

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "subscription_inactive" });
  });

  it.each(["OWNER", "ADMIN"])("perfil %s sem segundo fator cadastrado é recusado", async (roleKey) => {
    const { authorize, access, entitlements, user, token } = await setup();
    access.grant(user.userId, COMPANY_A, { roleKeys: [roleKey], permissions: ["company.read"] });

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "mfa_enrollment_required" });
    expect(entitlements.checks).toHaveLength(0);
  });

  it("perfil que exige MFA precisa confirmar o segundo fator na sessão", async () => {
    const { authorize, access, sessions, clock, user, token } = await setup({ mfa: { confirmed: true, secret: "S" } });
    access.grant(user.userId, COMPANY_A, { roleKeys: ["OWNER"], permissions: ["company.read"] });

    await expect(authorize(token, "company.read")).resolves.toEqual({ ok: false, reason: "mfa_required" });

    await sessions.setMfaVerified(token, clock.now());
    await expect(authorize(token, "company.read")).resolves.toMatchObject({ ok: true });
  });

  it("perfis sem exigência não precisam de segundo fator", async () => {
    const { authorize, access, user, token } = await setup();
    access.grant(user.userId, COMPANY_A, { roleKeys: ["COLABORADOR"], permissions: ["company.read"] });

    await expect(authorize(token, "company.read")).resolves.toMatchObject({ ok: true });
  });
});

describe("selectActiveCompany", () => {
  it("troca a empresa ativa quando há vínculo ativo e registra auditoria", async () => {
    const { selectActiveCompany, access, store, events, user, token } = await setup({ activeCompanyId: null });
    access.grant(user.userId, COMPANY_B);

    await expect(selectActiveCompany(token, { companyId: COMPANY_B }, context)).resolves.toEqual({
      ok: true,
      activeCompanyId: COMPANY_B,
    });
    expect(store.rows.get(`hash(${token})`)?.activeCompanyId).toBe(COMPANY_B);
    expect(events).toEqual([
      expect.objectContaining({ companyId: COMPANY_B, actorUserId: user.userId, action: "auth.active_company_selected" }),
    ]);
  });

  it.each([
    ["empresa sem vínculo", null],
    ["vínculo suspenso", { membershipStatus: "SUSPENDED" as const }],
    ["empresa suspensa", { companyActive: false }],
  ])("responde igual para %s, sem alterar a sessão", async (_label, grant) => {
    const { selectActiveCompany, access, store, events, user, token } = await setup();
    if (grant) access.grant(user.userId, COMPANY_B, grant);

    await expect(selectActiveCompany(token, { companyId: COMPANY_B }, context)).resolves.toEqual({
      ok: false,
      reason: "company_not_available",
    });
    expect(store.rows.get(`hash(${token})`)?.activeCompanyId).toBe(COMPANY_A);
    expect(events).toHaveLength(0);
  });

  it("recusa entrada inválida e sessão inválida", async () => {
    const { selectActiveCompany, token } = await setup();

    await expect(selectActiveCompany(token, { companyId: "não-é-uuid" }, context)).resolves.toEqual({
      ok: false,
      reason: "invalid_input",
    });
    await expect(selectActiveCompany(undefined, { companyId: COMPANY_B }, context)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
  });
});

describe("createCompanyQueries", () => {
  it("usa sempre a empresa do contexto autorizado", async () => {
    const calls: string[] = [];
    const directory: CompanyDirectory = {
      findCompany: async (companyId) => (calls.push(`company:${companyId}`), null),
      listMembers: async (companyId) => (calls.push(`members:${companyId}`), []),
      findMember: async (companyId, userId) => (calls.push(`member:${companyId}:${userId}`), null),
    };
    const queries = createCompanyQueries(directory);
    const authorized = { companyId: COMPANY_A, userId: "user-1", roleKeys: ["OWNER"], permissions: [] };

    await queries.currentCompany(authorized);
    await queries.listMembers(authorized);
    await queries.findMember(authorized, "user-2");

    expect(calls).toEqual([`company:${COMPANY_A}`, `members:${COMPANY_A}`, `member:${COMPANY_A}:user-2`]);
  });
});
