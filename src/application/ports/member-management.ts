import type { MembershipAccessStatus } from "./identity-repository";

/** A empresa ficaria sem nenhum Proprietário ativo. */
export class LastOwnerError extends Error {
  constructor() {
    super("a empresa precisa manter um Proprietário ativo");
    this.name = "LastOwnerError";
  }
}

/** A pessoa já é membro ativo ou suspenso da empresa. */
export class AlreadyMemberError extends Error {
  constructor() {
    super("a pessoa já é membro da empresa");
    this.name = "AlreadyMemberError";
  }
}

/** Convite expirado, revogado, já usado ou inexistente. */
export class InvitationNotAvailableError extends Error {
  constructor() {
    super("convite indisponível");
    this.name = "InvitationNotAvailableError";
  }
}

export interface RoleSummary {
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissions: readonly string[];
  /** Membros ativos com este perfil. */
  readonly memberCount: number;
}

export interface InvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly roleKey: string;
  readonly roleName: string;
  readonly invitedByName: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** Convite pendente encontrado pelo token (uso interno: contém o e-mail completo). */
export interface PendingInvitation {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string;
  /** Empresa ativa e não excluída. */
  readonly companyActive: boolean;
  readonly email: string;
  readonly roleId: string;
  readonly roleKey: string;
  readonly roleName: string;
  readonly expiresAt: Date;
}

export interface MemberState {
  readonly status: MembershipAccessStatus;
  readonly roleKeys: readonly string[];
}

/** Membros, perfis e convites. Toda operação recebe a empresa do contexto autorizado. */
export interface MemberManagementRepository {
  listRoles(companyId: string): Promise<RoleSummary[]>;
  /** Perfis da empresa com as chaves pedidas (as inexistentes ficam de fora). */
  findRoles(companyId: string, roleKeys: readonly string[]): Promise<Array<{ id: string; key: string }>>;
  /** Estado do vínculo, inclusive removido. */
  findMemberState(companyId: string, userId: string): Promise<MemberState | null>;
  /** Pessoa com este e-mail já tem vínculo não removido com a empresa. */
  isMemberByEmail(companyId: string, email: string): Promise<boolean>;

  /** Cria o convite e revoga os pendentes do mesmo e-mail na empresa, na mesma transação. */
  createInvitation(input: {
    companyId: string;
    email: string;
    roleId: string;
    tokenHash: string;
    invitedByUserId: string;
    expiresAt: Date;
    at: Date;
  }): Promise<InvitationRecord>;
  listPendingInvitations(companyId: string, at: Date): Promise<InvitationRecord[]>;
  revokeInvitation(companyId: string, invitationId: string, at: Date): Promise<boolean>;
  findPendingInvitation(tokenHash: string, at: Date): Promise<PendingInvitation | null>;

  /**
   * Usa o convite e ativa o vínculo com o perfil do convite (reaproveita um
   * vínculo removido).
   * @throws {InvitationNotAvailableError} @throws {AlreadyMemberError}
   */
  acceptInvitation(input: { invitationId: string; companyId: string; userId: string; roleId: string; at: Date }): Promise<void>;
  /**
   * Cria a pessoa já como membro da empresa do convite, sem criar empresa nova.
   * @throws {InvitationNotAvailableError} @throws AccountAlreadyExistsError
   */
  createAccountFromInvitation(input: {
    invitationId: string;
    companyId: string;
    roleId: string;
    name: string;
    email: string;
    passwordHash: string;
    cpf: { lookupHash: string; encrypted: string } | null;
    at: Date;
  }): Promise<{ userId: string }>;

  /** Substitui os perfis do membro. @throws {LastOwnerError} */
  replaceMemberRoles(companyId: string, userId: string, roleIds: readonly string[]): Promise<void>;
  /** Suspende, reativa ou remove (removido perde os perfis). @throws {LastOwnerError} */
  setMemberStatus(companyId: string, userId: string, status: "ACTIVE" | "SUSPENDED" | "REMOVED"): Promise<void>;
}
