import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from "./system-roles";

/**
 * Perfis que exigem segundo fator (decisão do usuário: OWNER e ADMIN).
 * Quem tem um desses perfis na empresa ativa só acessa depois de configurar
 * e confirmar o app autenticador na sessão.
 */
export const MFA_REQUIRED_ROLE_KEYS: readonly string[] = SYSTEM_ROLE_KEYS.filter(
  (key) => SYSTEM_ROLES[key].requiresMfa,
);

export function requiresMfa(roleKeys: readonly string[]): boolean {
  return roleKeys.some((key) => MFA_REQUIRED_ROLE_KEYS.includes(key));
}
