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
 * Entitlement: o módulo está contratado/ativo para a empresa?
 * Até a FASE 3 só existe o Core, obrigatório e sempre ativo.
 */
export interface EntitlementService {
  isModuleEnabled(companyId: string, moduleKey: ModuleKey): Promise<boolean>;
}

export interface CompanySummary {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
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
