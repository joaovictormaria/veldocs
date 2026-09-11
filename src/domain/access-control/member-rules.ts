import type { SystemRoleKey } from "./system-roles";

export const OWNER_ROLE_KEY: SystemRoleKey = "OWNER";

const hasOwner = (roleKeys: readonly string[]) => roleKeys.includes(OWNER_ROLE_KEY);

/**
 * Só um Proprietário concede o perfil Proprietário. Sem esta regra, um
 * Administrador (que tem todas as permissões) poderia se promover indiretamente
 * convidando ou promovendo alguém.
 */
export function canGrantRoles(actorRoleKeys: readonly string[], roleKeys: readonly string[]): boolean {
  return !hasOwner(roleKeys) || hasOwner(actorRoleKeys);
}

/** Só um Proprietário altera, suspende ou remove outro Proprietário. */
export function canManageMember(actorRoleKeys: readonly string[], targetRoleKeys: readonly string[]): boolean {
  return !hasOwner(targetRoleKeys) || hasOwner(actorRoleKeys);
}
