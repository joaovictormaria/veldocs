import type { Env } from "@/infrastructure/config/env";

export interface StorageConfig {
  /** Endereço que o servidor usa para falar com o storage. */
  readonly endpoint: string;
  /** Endereço que o navegador usa (upload e download por URL assinada). */
  readonly publicEndpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

/** `null` quando o storage não está configurado: o upload responde 503. */
export function storageConfigFrom(env: Env): StorageConfig | null {
  if (!env.STORAGE_ENDPOINT || !env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY) {
    return null;
  }
  return {
    endpoint: env.STORAGE_ENDPOINT,
    publicEndpoint: env.STORAGE_PUBLIC_ENDPOINT ?? env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  };
}

/**
 * Origem para onde o navegador envia os arquivos — a única origem externa
 * liberada no `connect-src` da CSP. Em estilo virtual-hosted o bucket vira
 * subdomínio do endpoint; em path-style, a origem é o próprio endpoint.
 */
export function storageBrowserOrigin(config: StorageConfig): string {
  const url = new URL(config.publicEndpoint);
  return config.forcePathStyle ? url.origin : `${url.protocol}//${config.bucket}.${url.host}`;
}
