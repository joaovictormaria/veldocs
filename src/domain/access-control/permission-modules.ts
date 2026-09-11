import type { CatalogPermission } from "./system-roles";

/**
 * Módulo ao qual cada permissão pertence (MASTER SPEC: tenant → RBAC →
 * entitlement → recurso). O catálogo comercial de módulos — preços,
 * dependências e ativação por empresa — pertence à FASE 3; aqui fica apenas
 * a associação que o código usa para exigir o entitlement correto.
 */
export const CORE_MODULE_KEY = "core";

export const MODULE_KEYS = [CORE_MODULE_KEY] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Declarado explicitamente: toda permissão nova precisa informar seu módulo. */
export const PERMISSION_MODULE = {
  "company.read": "core",
  "company.update": "core",
  "branches.read": "core",
  "branches.manage": "core",
  "departments.read": "core",
  "departments.manage": "core",
  "members.read": "core",
  "members.invite": "core",
  "members.manage": "core",
  "roles.read": "core",
  "roles.manage": "core",
  "categories.read": "core",
  "categories.manage": "core",
  "documents.read": "core",
  "documents.create": "core",
  "documents.update": "core",
  "documents.delete": "core",
  "audit.read": "core",
} as const satisfies Record<CatalogPermission, ModuleKey>;

export function moduleOfPermission(permission: CatalogPermission): ModuleKey {
  return PERMISSION_MODULE[permission];
}
