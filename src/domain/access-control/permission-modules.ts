import { CORE_MODULE_KEY, MODULE_KEYS, type ModuleKey } from "@/domain/billing/module-catalog";
import type { CatalogPermission } from "./system-roles";

/**
 * Módulo ao qual cada permissão pertence (MASTER SPEC: tenant → RBAC →
 * entitlement → recurso). As chaves vêm do catálogo comercial
 * (`domain/billing/module-catalog.ts`); aqui fica só a associação que o
 * código usa para exigir o entitlement correto.
 *
 * A gestão documental é do Core. As capacidades de módulo pago aparecem aqui
 * conforme são implementadas: `expirations.*` pertencem ao Controle de
 * vencimentos, então só valem para quem contratou esse módulo — o perfil dá a
 * permissão, o entitlement dá o módulo, e os dois precisam concordar.
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
  "expirations.read": "vencimentos",
  "expirations.manage": "vencimentos",
  "audit.read": "core",
  "billing.read": "core",
  "billing.manage": "core",
} as const satisfies Record<CatalogPermission, ModuleKey>;

export function moduleOfPermission(permission: CatalogPermission): ModuleKey {
  return PERMISSION_MODULE[permission];
}

/**
 * Permissões que valem mesmo com a assinatura inválida (trial vencido, atraso,
 * cancelada ou suspensa). A spec (2.9) exige caminho claro para assinar ou
 * reativar: a empresa bloqueada precisa continuar vendo a própria situação e
 * o catálogo. Só permissões de assinatura podem entrar aqui.
 */
export const SUBSCRIPTION_EXEMPT_PERMISSIONS: ReadonlySet<CatalogPermission> = new Set<CatalogPermission>([
  "billing.read",
  "billing.manage",
]);

export function bypassesSubscription(permission: CatalogPermission): boolean {
  return SUBSCRIPTION_EXEMPT_PERMISSIONS.has(permission);
}
