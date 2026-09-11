import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_CATALOG, SYSTEM_ROLE_KEYS } from "@/domain/access-control/system-roles";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthServices } from "@/infrastructure/composition/auth-services";
import { createPrismaRateLimiter } from "@/infrastructure/database/prisma-rate-limiter";
import { createFieldEncryptor, sha256Hex } from "@/infrastructure/security/crypto";
import { formatCpf, generateValidCpf } from "../../support/cpf";
import {
  TEST_APPLICATION_KEYS,
  createTestAuthServices,
  createTestPrismaClient,
  truncateAllTables,
} from "../support/database";

const PASSWORD = "uma frase longa e secreta";
const context = { ipAddress: "203.0.113.10", userAgent: "vitest" };

let prisma: PrismaClient;
let auth: AuthServices;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  auth = createTestAuthServices(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const uniqueEmail = () => `pessoa-${randomUUID().slice(0, 8)}@example.com`;

async function registerAccount(overrides: Record<string, unknown> = {}) {
  const input = {
    name: "Maria Silva",
    email: uniqueEmail(),
    password: PASSWORD,
    companyName: "Padaria São João",
    ...overrides,
  };
  const result = await auth.register(input, context);
  if (!result.ok) throw new Error(`cadastro falhou: ${JSON.stringify(result)}`);
  return { input, result };
}

describe("cadastro", () => {
  it("cria pessoa, empresa, perfis padrão e vínculo OWNER, e inicia sessão na empresa", async () => {
    const { input, result } = await registerAccount();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe(input.email);
    expect(user.passwordHash?.startsWith("$argon2id$")).toBe(true);
    expect(user.passwordHash).not.toContain(PASSWORD);

    const company = await prisma.company.findUniqueOrThrow({ where: { id: result.companyId } });
    expect(company.slug).toMatch(/^padaria-sao-joao-[a-z0-9]{8}$/);

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { companyId_userId: { companyId: result.companyId, userId: result.userId } },
      include: { roles: { include: { role: true } } },
    });
    expect(membership.status).toBe("ACTIVE");
    expect(membership.roles.map((assignment) => assignment.role.key)).toEqual(["OWNER"]);

    const roles = await prisma.role.findMany({
      where: { companyId: result.companyId },
      include: { _count: { select: { permissions: true } } },
    });
    expect(roles.map((role) => role.key).sort()).toEqual([...SYSTEM_ROLE_KEYS].sort());
    expect(roles.every((role) => role.isSystem)).toBe(true);
    expect(roles.find((role) => role.key === "OWNER")?._count.permissions).toBe(ALL_PERMISSIONS.length);
    expect(await prisma.permission.count()).toBe(Object.keys(PERMISSION_CATALOG).length);

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sha256Hex(result.session.token) } });
    expect(session.activeCompanyId).toBe(result.companyId);
    expect(await prisma.session.count({ where: { id: result.session.token } })).toBe(0);

    const actions = (await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((event) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["auth.account_registered", "company.created"]));
  });

  it("guarda o CPF apenas como hash de busca e valor cifrado", async () => {
    const cpf = generateValidCpf();
    const { result } = await registerAccount({ cpf: formatCpf(cpf) });

    const [row] = await prisma.$queryRaw<Array<{ cpf_lookup_hash: string; cpf_encrypted: string }>>`
      SELECT cpf_lookup_hash, cpf_encrypted FROM users WHERE id = ${result.userId}::uuid
    `;
    expect(row?.cpf_lookup_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.cpf_encrypted).not.toContain(cpf);

    const encryptor = createFieldEncryptor(Buffer.from(TEST_APPLICATION_KEYS.APP_ENCRYPTION_KEY, "base64"), "users.cpf");
    expect(encryptor.decrypt(row?.cpf_encrypted ?? "")).toBe(cpf);

    const [{ leaks } = { leaks: -1 }] = await prisma.$queryRaw<Array<{ leaks: number }>>`
      SELECT count(*)::int AS leaks FROM users
      WHERE cpf_lookup_hash = ${cpf} OR cpf_encrypted LIKE ${`%${cpf}%`} OR email LIKE ${`%${cpf}%`}
    `;
    expect(leaks).toBe(0);
  });

  it("responde de forma genérica para e-mail ou CPF já cadastrados, sem criar nada", async () => {
    const cpf = generateValidCpf();
    const { input } = await registerAccount({ cpf });

    await expect(auth.register({ ...input, companyName: "Outra" }, context)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
    await expect(auth.register({ ...input, email: uniqueEmail(), companyName: "Outra" }, context)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });

    expect(await prisma.company.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("aponta os campos inválidos sem criar conta", async () => {
    const result = await auth.register(
      { name: "Maria", email: "email-invalido", password: "curta", companyName: "Empresa", cpf: "111.111.111-11" },
      context,
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "invalid_input") throw new Error("esperava invalid_input");
    expect(result.issues.map((issue) => issue.field).sort()).toEqual(["cpf", "email", "password"]);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("login", () => {
  it("autentica por e-mail (sem diferenciar maiúsculas) e por CPF com máscara", async () => {
    const cpf = generateValidCpf();
    const { input, result } = await registerAccount({ cpf });

    const byEmail = await auth.login({ identifier: input.email.toUpperCase(), password: PASSWORD }, context);
    const byCpf = await auth.login({ identifier: formatCpf(cpf), password: PASSWORD }, context);

    expect(byEmail).toMatchObject({ ok: true, userId: result.userId });
    expect(byCpf).toMatchObject({ ok: true, userId: result.userId });
    if (!byEmail.ok) throw new Error("login falhou");
    expect(byEmail.session.activeCompanyId).toBe(result.companyId);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: result.userId } })).lastLoginAt).not.toBeNull();
  });

  it("responde igual para senha errada, conta inexistente e conta desativada, sem registrar dados pessoais", async () => {
    const cpf = generateValidCpf();
    const { input, result } = await registerAccount({ cpf });

    const wrongPassword = await auth.login({ identifier: input.email, password: "senha errada qualquer" }, context);
    const unknownAccount = await auth.login({ identifier: uniqueEmail(), password: PASSWORD }, context);
    await prisma.user.update({ where: { id: result.userId }, data: { status: "DISABLED" } });
    const disabled = await auth.login({ identifier: input.email, password: PASSWORD }, context);

    for (const attempt of [wrongPassword, unknownAccount, disabled]) {
      expect(attempt).toEqual({ ok: false, reason: "invalid_credentials" });
    }

    const failures = await prisma.auditLog.findMany({ where: { action: "auth.login_failed" } });
    expect(failures).toHaveLength(3);
    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain(input.email);
    expect(serialized).not.toContain(cpf);
    expect(serialized).not.toContain(PASSWORD);
  });

  it("bloqueia a conta após 10 tentativas em 15 minutos, mesmo com a senha correta", async () => {
    const { input } = await registerAccount();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        auth.login({ identifier: input.email, password: "senha errada qualquer" }, context),
      ).resolves.toEqual({ ok: false, reason: "invalid_credentials" });
    }

    const blocked = await auth.login({ identifier: input.email, password: PASSWORD }, context);
    expect(blocked).toMatchObject({ ok: false, reason: "rate_limited" });
    if (blocked.ok || blocked.reason !== "rate_limited") throw new Error("esperava rate_limited");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: "auth.login_rate_limited" } })).toBe(1);
  });

  it("não define empresa ativa quando a pessoa tem vínculo ativo com mais de uma empresa", async () => {
    const { input, result } = await registerAccount();
    const other = await prisma.company.create({ data: { name: "Escritório Contábil", slug: `contabil-${randomUUID().slice(0, 8)}` } });
    await prisma.membership.create({ data: { companyId: other.id, userId: result.userId, status: "ACTIVE" } });

    const login = await auth.login({ identifier: input.email, password: PASSWORD }, context);

    if (!login.ok) throw new Error("login falhou");
    expect(login.session.activeCompanyId).toBeNull();
    const current = await auth.getCurrentSession(login.session.token);
    expect(current?.memberships.map((membership) => membership.companyName).sort()).toEqual([
      "Escritório Contábil",
      "Padaria São João",
    ]);
  });
});

describe("sessão", () => {
  it("retorna pessoa e vínculos, e deixa de autenticar após logout", async () => {
    const { input, result } = await registerAccount();
    const token = result.session.token;

    const current = await auth.getCurrentSession(token);
    expect(current?.user).toEqual({ id: result.userId, name: "Maria Silva", email: input.email });
    expect(current?.memberships).toEqual([
      { companyId: result.companyId, companyName: "Padaria São João", status: "ACTIVE", roleKeys: ["OWNER"] },
    ]);

    await auth.logout(token, context);

    expect(await auth.getCurrentSession(token)).toBeNull();
    expect((await prisma.session.findUniqueOrThrow({ where: { id: sha256Hex(token) } })).revokedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "auth.logout", actorUserId: result.userId } })).toBe(1);
  });

  it("não autentica token malformado, desconhecido ou de pessoa desativada", async () => {
    const { result } = await registerAccount();

    expect(await auth.getCurrentSession(undefined)).toBeNull();
    expect(await auth.getCurrentSession("token-invalido")).toBeNull();
    expect(await auth.getCurrentSession("A".repeat(43))).toBeNull();

    await prisma.user.update({ where: { id: result.userId }, data: { status: "DISABLED" } });
    expect(await auth.getCurrentSession(result.session.token)).toBeNull();
  });

  it("logout de todas as sessões encerra as demais sessões da pessoa", async () => {
    const { input, result } = await registerAccount();
    const second = await auth.login({ identifier: input.email, password: PASSWORD }, context);
    if (!second.ok) throw new Error("login falhou");

    await expect(auth.logoutAll(second.session.token, context)).resolves.toBe(true);

    expect(await auth.getCurrentSession(result.session.token)).toBeNull();
    expect(await auth.getCurrentSession(second.session.token)).toBeNull();
    await expect(auth.logoutAll(second.session.token, context)).resolves.toBe(false);
  });
});

describe("rate limiter no PostgreSQL", () => {
  it("conta tentativas concorrentes sem perder incrementos", async () => {
    const limiter = createPrismaRateLimiter(prisma);
    const rule = { limit: 10, windowMs: 60_000 };

    const results = await Promise.all(Array.from({ length: 25 }, () => limiter.consume("teste:concorrencia", rule)));

    expect(results.filter((result) => result.allowed)).toHaveLength(10);
    expect((await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: "teste:concorrencia" } })).count).toBe(25);
  });

  it("reinicia a contagem quando a janela expira", async () => {
    const limiter = createPrismaRateLimiter(prisma);
    await limiter.consume("teste:janela", { limit: 1, windowMs: 60_000 });
    await prisma.rateLimitBucket.update({ where: { key: "teste:janela" }, data: { resetAt: new Date(Date.now() - 1_000) } });

    const result = await limiter.consume("teste:janela", { limit: 1, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect((await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key: "teste:janela" } })).count).toBe(1);
  });
});
