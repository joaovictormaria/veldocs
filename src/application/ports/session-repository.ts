export interface StoredSession {
  /** Hash do token (o token nunca é armazenado). */
  readonly id: string;
  readonly userId: string;
  readonly activeCompanyId: string | null;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly mfaVerifiedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface NewSession {
  readonly id: string;
  readonly userId: string;
  readonly activeCompanyId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface SessionRepository {
  create(session: NewSession): Promise<void>;
  findById(id: string): Promise<StoredSession | null>;
  extend(id: string, expiresAt: Date, seenAt: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  /** Revoga todas as sessões ainda ativas da pessoa e informa quantas foram. */
  revokeAllForUser(userId: string, at: Date): Promise<number>;
}
