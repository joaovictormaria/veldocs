import { z } from "zod";

/**
 * Chave de permissão no formato `recurso.acao` (ex.: `documents.read`).
 * Recursos podem ser aninhados (`company.branches.update`); a ação é sempre o
 * último segmento. O mesmo formato é garantido por CHECK no banco
 * (`permissions.key`).
 */
export const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
export const PERMISSION_KEY_MAX_LENGTH = 100;

export const permissionKeySchema = z
  .string()
  .max(PERMISSION_KEY_MAX_LENGTH)
  .regex(PERMISSION_KEY_PATTERN, { error: "formato esperado: recurso.acao" });

export type PermissionKey = z.infer<typeof permissionKeySchema>;

export interface ParsedPermissionKey {
  readonly resource: string;
  readonly action: string;
}

export function parsePermissionKey(value: string): ParsedPermissionKey {
  const key = permissionKeySchema.parse(value);
  const separator = key.lastIndexOf(".");
  return { resource: key.slice(0, separator), action: key.slice(separator + 1) };
}
