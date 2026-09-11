import { loadEnv } from "vite";
import { createS3StorageProvider } from "@/infrastructure/storage/s3-storage-provider";
import type { StorageConfig } from "@/infrastructure/storage/storage-config";

/**
 * Storage dos testes de integração: o MinIO local (ou o do CI), num bucket
 * próprio. Como os testes criam e apagam objetos, só aceitamos bucket cujo
 * nome termina em `-test` — a mesma proteção do banco de testes.
 */
export function getTestStorageConfig(): StorageConfig {
  const env = loadEnv("test", process.cwd(), "");
  const bucket = env.TEST_STORAGE_BUCKET;
  const endpoint = env.STORAGE_ENDPOINT;

  if (!bucket || !endpoint || !env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error("Storage de testes não configurado: veja TEST_STORAGE_BUCKET e STORAGE_* no .env.example.");
  }
  if (!bucket.endsWith("-test")) {
    throw new Error(`TEST_STORAGE_BUCKET deve terminar em "-test" (recebido: "${bucket}").`);
  }

  return {
    endpoint,
    publicEndpoint: env.STORAGE_PUBLIC_ENDPOINT || endpoint,
    region: env.STORAGE_REGION || "us-east-1",
    bucket,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE !== "false",
  };
}

export function createTestStorage() {
  return createS3StorageProvider(getTestStorageConfig());
}

/** Envia como o navegador: campos assinados primeiro, arquivo por último. */
export async function postToStorage(
  upload: { readonly url: string; readonly fields: Readonly<Record<string, string>> },
  content: Uint8Array,
  options: { readonly contentType?: string; readonly fileName?: string } = {},
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  if (options.contentType) form.set("Content-Type", options.contentType);
  form.append("file", new Blob([Buffer.from(content)]), options.fileName ?? "arquivo");
  return fetch(upload.url, { method: "POST", body: form });
}
