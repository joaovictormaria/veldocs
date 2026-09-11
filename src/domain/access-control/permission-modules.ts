import { CORE_MODULE_KEY, MODULE_KEYS, type ModuleKey } from "@/domain/billing/module-catalog";
import type { CatalogPermission } from "./system-roles";

/**
 * Módulo ao qual cada permissão pertence (MASTER SPEC: tenant → RBAC →
 * entitlement → recurso). As chaves vêm do catálogo comercial
 * (`domain/billing/module-catalog.ts`); aqui fica só a associação que o
 * código usa para exigir o entitlement correto.
 *
 * Todas as permissões de hoje são do Core: as capacidades dos módulos pagos
 * (vencimentos, funcionários, contratos...) ainda não existem e ganharão suas
 * permissões nas fases em que forem implementadas.
 */
export { CORE_MODULE_KEY, MODULE_KEYS, type ModuleKey };

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
