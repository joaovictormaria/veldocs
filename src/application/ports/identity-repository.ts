import type { SystemRoleDefinition } from "@/domain/access-control/system-roles";

export type UserAccountStatus = "ACTIVE" | "DISABLED";
export type MembershipAccessStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export interface UserCredentials {
  readonly userId: string;
  readonly status: UserAccountStatus;
  /** Nulo quando a pessoa só entra por link mágico ou Google. */
  readonly passwordHash: string | null;
}

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface MembershipSummary {
  readonly companyId: string;
  readonly companyName: string;
  readonly status: MembershipAccessStatus;
  readonly roleKeys: readonly string[];
}

export interface NewAccountInput {
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly cpf: { readonly lookupHash: string; readonly encrypted: string } | null;
  readonly company: { readonly name: string; readonly slug: string };
  readonly roles: readonly SystemRoleDefinition[];
  readonly creatorRoleKey: string;
  readonly permissionCatalog: Readonly<Record<string, string>>;
}

export interface IdentityRepository {
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findCredentialsByCpfLookupHash(lookupHash: string): Promise<UserCredentials | null>;
  /**
   * Cria, numa única transação, a pessoa, a empresa, os perfis padrão com
   * permissões e o vínculo ativo com o perfil do criador.
   * Lança `AccountAlreadyExistsError` quando e-mail ou CPF já existem.
   */
  createAccountWithCompany(input: NewAccountInput): Promise<{ userId: string; companyId: string }>;
  /** Somente pessoas ativas e não excluídas. */
  findActiveProfile(userId: string): Promise<UserProfile | null>;
  listMemberships(userId: string): Promise<MembershipSummary[]>;
  recordSuccessfulLogin(userId: string, at: Date): Promise<void>;
}
