import { describe, expect, it } from "vitest";
import { createSessionManager, DEFAULT_SESSION_POLICY } from "@/application/auth/session-manager";
import { createFakeClock, createFakeTokens, createInMemorySessions } from "./fakes";

const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const clock = createFakeClock();
  const store = createInMemorySessions();
  const tokens = createFakeTokens();
  const manager = createSessionManager({ sessions: store.repository, tokens, now: clock.now });
  return { clock, store, tokens, manager };
}

const newSession = (manager: ReturnType<typeof setup>["manager"]) =>
  manager.issue({ userId: "user-1", activeCompanyId: "company-1", ipAddress: "203.0.113.10", userAgent: "teste" });

describe("SessionManager", () => {
  it("emite token novo, grava apenas o hash e define expirações de 7 e 30 dias", async () => {
    const { clock, store, manager } = setup();

    const issued = await newSession(manager);

    expect(store.rows.has(issued.token)).toBe(false);
    expect(store.rows.has(`hash(${issued.token})`)).toBe(true);
    expect(issued.expiresAt.getTime() - clock.now().getTime()).toBe(DEFAULT_SESSION_POLICY.idleTimeoutMs);
    expect(issued.absoluteExpiresAt.getTime() - clock.now().getTime()).toBe(DEFAULT_SESSION_POLICY.absoluteTimeoutMs);
    expect(DEFAULT_SESSION_POLICY).toEqual({ idleTimeoutMs: 7 * DAY, absoluteTimeoutMs: 30 * DAY });
  });

  it("gera tokens diferentes a cada emissão", async () => {
    const { manager } = setup();

    expect((await newSession(manager)).token).not.toBe((await newSession(manager)).token);
  });

  it("valida sessão ativa e descarta token malformado sem consultar o repositório", async () => {
    const { store, manager } = setup();
    const issued = await newSession(manager);

    await expect(manager.validate(issued.token)).resolves.toMatchObject({ userId: "user-1", activeCompanyId: "company-1" });
    await expect(manager.validate("qualquer-coisa")).resolves.toBeNull();
    await expect(manager.validate(undefined)).resolves.toBeNull();
    expect(store.lookups).toEqual([`hash(${issued.token})`]);
  });

  it("expira após 7 dias sem uso", async () => {
    const { clock, manager } = setup();
    const issued = await newSession(manager);

    clock.advance(7 * DAY);

    await expect(manager.validate(issued.token)).resolves.toBeNull();
  });

  it("renova a inatividade com o uso depois de passada metade da janela", async () => {
    const { clock, store, manager } = setup();
    const issued = await newSession(manager);

    clock.advance(DAY);
    await manager.validate(issued.token);
    expect(store.rows.get(`hash(${issued.token})`)?.expiresAt).toEqual(issued.expiresAt);

    clock.advance(3 * DAY);
    const renewed = await manager.validate(issued.token);
    expect(renewed?.expiresAt.getTime()).toBe(clock.now().getTime() + 7 * DAY);

    clock.advance(6 * DAY);
    await expect(manager.validate(issued.token)).resolves.not.toBeNull();
  });

  it("nunca ultrapassa a expiração absoluta de 30 dias, mesmo com uso contínuo", async () => {
    const { clock, manager } = setup();
    const issued = await newSession(manager);

    for (let day = 0; day < 29; day += 4) {
      clock.advance(4 * DAY);
      const session = await manager.validate(issued.token);
      if (session) expect(session.expiresAt.getTime()).toBeLessThanOrEqual(issued.absoluteExpiresAt.getTime());
    }

    clock.advance(issued.absoluteExpiresAt.getTime() - clock.now().getTime());
    await expect(manager.validate(issued.token)).resolves.toBeNull();
  });

  it("revoga uma sessão e todas as sessões da pessoa", async () => {
    const { manager } = setup();
    const first = await newSession(manager);
    const second = await newSession(manager);
    const third = await newSession(manager);

    await expect(manager.revoke(first.token)).resolves.toMatchObject({ userId: "user-1" });
    await expect(manager.validate(first.token)).resolves.toBeNull();
    await expect(manager.revoke(first.token)).resolves.toBeNull();

    await expect(manager.revokeAllForUser("user-1")).resolves.toBe(2);
    await expect(manager.validate(second.token)).resolves.toBeNull();
    await expect(manager.validate(third.token)).resolves.toBeNull();
  });
});
