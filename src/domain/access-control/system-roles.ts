/**
 * Catálogo de permissões e perfis padrão provisionados em toda empresa nova.
 * Chaves no formato `recurso.acao` (ver permission-key.ts).
 */
export const PERMISSION_CATALOG = {
  "company.read": "Ver os dados da empresa",
  "company.update": "Editar os dados da empresa",
  "branches.read": "Ver filiais",
  "branches.manage": "Criar, editar e remover filiais",
  "departments.read": "Ver setores",
  "departments.manage": "Criar, editar e remover setores",
  "members.read": "Ver membros da empresa",
  "members.invite": "Convidar pessoas para a empresa",
  "members.manage": "Alterar perfis, suspender e remover membros",
  "roles.read": "Ver perfis de acesso",
  "roles.manage": "Criar e editar perfis de acesso",
  "categories.read": "Ver categorias de documentos",
  "categories.manage": "Criar, editar e remover categorias de documentos",
  "documents.read": "Ver documentos",
  "documents.create": "Criar documentos",
  "documents.update": "Editar documentos",
  "documents.delete": "Excluir documentos",
  "audit.read": "Ver a trilha de auditoria",
} as const;

export type CatalogPermission = keyof typeof PERMISSION_CATALOG;

export const ALL_PERMISSIONS = Object.keys(PERMISSION_CATALOG) as CatalogPermission[];

const READ_ONLY: readonly CatalogPermission[] = [
  "company.read",
  "branches.read",
  "departments.read",
  "categories.read",
  "documents.read",
];

export const SYSTEM_ROLE_KEYS = ["OWNER", "ADMIN", "GESTOR", "COLABORADOR", "VISUALIZADOR"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface SystemRoleDefinition {
  readonly key: SystemRoleKey;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly CatalogPermission[];
  /** Perfis que exigem segundo fator (MFA) para acessar a empresa. */
  readonly requiresMfa: boolean;
}

export const SYSTEM_ROLES: Readonly<Record<SystemRoleKey, SystemRoleDefinition>> = {
  OWNER: {
    key: "OWNER",
    name: "Proprietário",
    description: "Controle total da empresa, inclusive dos administradores",
    permissions: ALL_PERMISSIONS,
    requiresMfa: true,
  },
  ADMIN: {
    key: "ADMIN",
    name: "Administrador",
    description: "Administra a empresa, membros, perfis e documentos",
    permissions: ALL_PERMISSIONS,
    requiresMfa: true,
  },
  GESTOR: {
    key: "GESTOR",
    name: "Gestor",
    description: "Gerencia documentos e categorias e acompanha a equipe",
    permissions: [
      ...READ_ONLY,
      "members.read",
      "categories.manage",
      "documents.create",
      "documents.update",
      "documents.delete",
      "audit.read",
    ],
    requiresMfa: false,
  },
  COLABORADOR: {
    key: "COLABORADOR",
    name: "Colaborador",
    description: "Cria e atualiza documentos",
    permissions: [...READ_ONLY, "documents.create", "documents.update"],
    requiresMfa: false,
  },
  VISUALIZADOR: {
    key: "VISUALIZADOR",
    name: "Visualizador",
    description: "Somente leitura",
    permissions: READ_ONLY,
    requiresMfa: false,
  },
};

/** Perfil atribuído a quem cria a empresa. */
export const COMPANY_CREATOR_ROLE: SystemRoleKey = "OWNER";
