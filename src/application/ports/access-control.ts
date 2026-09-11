import type { ModuleKey } from "@/domain/access-control/permission-modules";
import type { MembershipAccessStatus } from "./identity-repository";

export interface MembershipAccess {
  readonly membershipStatus: MembershipAccessStatus;
  /** Empresa com status ACTIVE e não excluída. */
  readonly companyActive: boolean;
  readonly roleKeys: readonly string[];
  /** União das permissões de todos os perfis do vínculo. */
  readonly permissions: readonly string[];
}

export interface AccessControlRepository {
  findMembershipAccess(userId: string, companyId: string): Promise<MembershipAccess | null>;
}

/**
 * Resultado do entitlement:
 * - `enabled`: pode usar;
 * - `module_not_enabled`: o módulo não está contratado/ativo para a empresa;
 * - `subscription_inactive`: a assinatura existe mas não é válida (trial
 *   vencido, atraso, cancelada ou suspensa) e TUDO fica bloqueado, Core
 *   incluído — os dados continuam guardados (DEC-022).
 */
export type EntitlementCheck = "enabled" | "module_not_enabled" | "subscription_inactive";

export interface EntitlementService {
  checkModule(companyId: string, moduleKey: ModuleKey): Promise<EntitlementCheck>;
}

export interface CompanySummary {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  /** CNPJ, somente dígitos. */
  readonly taxId: string | null;
  readonly slug: string;
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly createdAt: Date;
}

export interface CompanyMember {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly status: MembershipAccessStatus;
  readonly roleKeys: readonly string[];
  readonly joinedAt: Date;
}

/** Consultas sempre escopadas pela empresa recebida (vinda da sessão autorizada). */
export interface CompanyDirectory {
  findCompany(companyId: string): Promise<CompanySummary | null>;
  listMembers(companyId: string): Promise<CompanyMember[]>;
  findMember(companyId: string, userId: string): Promise<CompanyMember | null>;
}
