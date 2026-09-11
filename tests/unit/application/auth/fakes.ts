import type { AccessControlRepository, EntitlementService, MembershipAccess } from "@/application/ports/access-control";
import type { AuditEvent, AuditLogger } from "@/application/ports/audit-logger";
import type {
  IdentityRepository,
  MembershipSummary,
  NewAccountInput,
  UserCredentials,
} from "@/application/ports/identity-repository";
import type { PasswordHasher } from "@/application/ports/password-hasher";
import type { RateLimiter, RateLimitRule } from "@/application/ports/rate-limiter";
import type { SensitiveDataProtector, TokenService } from "@/application/ports/security-tokens";
import type { NewSession, SessionRepository, StoredSession } from "@/application/ports/session-repository";
import { AccountAlreadyExistsError } from "@/application/auth/shared";

export function createFakeClock(start = "2026-09-11T12:00:00.000Z") {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

export function createFakeTokens(): TokenService {
  let counter = 0;
  return {
    generate: () => `tok_${String((counter += 1)).padStart(8, "0")}`,
    hash: (token) => `hash(${token})`,
    isWellFormed: (token) => /^tok_\d{8}$/.test(token),
  };
}

export function createInMemorySessions() {
  const rows = new Map<string, StoredSession & { lastSeenAt: Date; ipAddress: string | null }>();
  const lookups: string[] = [];

  const repository: SessionRepository = {
    async create(session: NewSession) {
      rows.set(session.id, { ...session, lastSeenAt: session.createdAt, mfaVerifiedAt: null, revokedAt: null });
    },
    async findById(id) {
      lookups.push(id);
      return rows.get(id) ?? null;
    },
    async extend(id, expiresAt, seenAt) {
      const row = rows.get(id);
      if (row && !row.revokedAt) rows.set(id, { ...row, expiresAt, lastSeenAt: seenAt });
    },
    async setActiveCompany(id, companyId) {
      const row = rows.get(id);
      if (row && !row.revokedAt) rows.set(id, { ...row, activeCompanyId: companyId });
    },
    async revoke(id, at) {
      const row = rows.get(id);
      if (row && !row.revokedAt) rows.set(id, { ...row, revokedAt: at });
    },
    async revokeAllForUser(userId, at) {
      let count = 0;
      for (const [id, row] of rows) {
        if (row.userId === userId && !row.revokedAt) {
          rows.set(id, { ...row, revokedAt: at });
          count += 1;
        }
      }
      return count;
    },
  };

  return { repository, rows, lookups };
}

export function createFakeHasher() {
  const verifiedHashes: string[] = [];
  const hasher: PasswordHasher = {
    hash: async (password) => `hashed(${password})`,
    verify: async (passwordHash, password) => {
      verifiedHashes.push(passwordHash);
      return passwordHash === `hashed(${password})`;
    },
  };
  return { hasher, verifiedHashes };
}

export function createFakeRateLimiter(blockedPrefixes: readonly string[] = []) {
  const consumed: Array<{ key: string; rule: RateLimitRule }> = [];
  const limiter: RateLimiter = {
    async consume(key, rule) {
      consumed.push({ key, rule });
      const blocked = blockedPrefixes.some((prefix) => key.startsWith(prefix));
      return { allowed: !blocked, remaining: blocked ? 0 : rule.limit - 1, resetAt: new Date("2026-09-11T12:10:00.000Z") };
    },
  };
  return { limiter, consumed };
}

export function createFakeAudit() {
  const events: AuditEvent[] = [];
  const audit: AuditLogger = {
    record: async (event) => {
      events.push(event);
    },
  };
  return { audit, events };
}

export function createFakeAccess() {
  const grants = new Map<string, MembershipAccess>();
  const lookups: string[] = [];
  const repository: AccessControlRepository = {
    async findMembershipAccess(userId, companyId) {
      lookups.push(`${userId}@${companyId}`);
      return grants.get(`${userId}@${companyId}`) ?? null;
    },
  };
  const grant = (userId: string, companyId: string, access: Partial<MembershipAccess> = {}) => {
    grants.set(`${userId}@${companyId}`, {
      membershipStatus: "ACTIVE",
      companyActive: true,
      roleKeys: ["OWNER"],
      permissions: ["company.read", "members.read"],
      ...access,
    });
  };
  return { repository, grant, lookups };
}

export function createFakeEntitlements(enabled = true) {
  const checks: string[] = [];
  const service: EntitlementService = {
    async isModuleEnabled(companyId, moduleKey) {
      checks.push(`${companyId}:${moduleKey}`);
      return enabled;
    },
  };
  return { service, checks };
}

export const fakeProtector: SensitiveDataProtector = {
  lookupHash: (purpose, value) => `hmac(${purpose}:${value})`,
  encryptCpf: (cpf) => `enc(${cpf})`,
};

interface FakeUser extends UserCredentials {
  readonly email: string;
  readonly cpfLookupHash: string | null;
  readonly name: string;
}

export function createFakeIdentity() {
  const users: FakeUser[] = [];
  const memberships = new Map<string, MembershipSummary[]>();
  const createdAccounts: NewAccountInput[] = [];
  const logins: string[] = [];

  const identity: IdentityRepository = {
    async findCredentialsByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async findCredentialsByCpfLookupHash(lookupHash) {
      return users.find((user) => user.cpfLookupHash === lookupHash) ?? null;
    },
    async createAccountWithCompany(input) {
      if (users.some((user) => user.email === input.email || (input.cpf && user.cpfLookupHash === input.cpf.lookupHash))) {
        throw new AccountAlreadyExistsError();
      }
      createdAccounts.push(input);
      const userId = `user-${users.length + 1}`;
      const companyId = `company-${createdAccounts.length}`;
      users.push({
        userId,
        email: input.email,
        name: input.name,
        cpfLookupHash: input.cpf?.lookupHash ?? null,
        passwordHash: input.passwordHash,
        status: "ACTIVE",
      });
      memberships.set(userId, [
        { companyId, companyName: input.company.name, status: "ACTIVE", roleKeys: [input.creatorRoleKey] },
      ]);
      return { userId, companyId };
    },
    async findActiveProfile(userId) {
      const user = users.find((candidate) => candidate.userId === userId && candidate.status === "ACTIVE");
      return user ? { id: user.userId, name: user.name, email: user.email } : null;
    },
    async listMemberships(userId) {
      return memberships.get(userId) ?? [];
    },
    async recordSuccessfulLogin(userId) {
      logins.push(userId);
    },
  };

  const addUser = (user: Partial<FakeUser> & { email: string; password: string }) => {
    const created: FakeUser = {
      userId: user.userId ?? `user-${users.length + 1}`,
      email: user.email,
      name: user.name ?? "Pessoa Teste",
      cpfLookupHash: user.cpfLookupHash ?? null,
      passwordHash: `hashed(${user.password})`,
      status: user.status ?? "ACTIVE",
    };
    users.push(created);
    return created;
  };

  return { identity, users, memberships, createdAccounts, logins, addUser };
}
