import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertObjectInTenant, type StorageProvider } from "@/application/ports/storage-provider";
import type { StorageConfig } from "./storage-config";

const BACKSLASH = String.fromCharCode(92);

/**
 * `Content-Disposition` de download (RFC 6266): nome ASCII de reserva para
 * navegadores antigos e o nome completo em UTF-8.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = [...fileName].map((char) => (char.charCodeAt(0) < 128 && char !== '"' && char !== BACKSLASH ? char : "_")).join("");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

const isNotFound = (error: unknown) => {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate?.name === "NotFound" || candidate?.$metadata?.httpStatusCode === 404;
};

/**
 * Storage S3 compatível: Railway Storage Buckets em produção, MinIO local.
 *
 * Dois clientes: o do servidor usa `endpoint`; o que assina URLs para o
 * navegador usa `publicEndpoint`, porque a assinatura inclui o host — no
 * docker-compose o servidor enxerga `storage:9000` e o navegador, o loopback.
 *
 * Toda operação confere que a chave está no prefixo da empresa antes de falar
 * com o bucket.
 */
export function createS3StorageProvider(config: StorageConfig): StorageProvider {
  const client = (endpoint: string) =>
    new S3Client({
      endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Os checksums automáticos das versões recentes do SDK não são aceitos por
      // todo storage S3 compatível; só quando a operação exige.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

  const server = client(config.endpoint);
  const browser = config.publicEndpoint === config.endpoint ? server : client(config.publicEndpoint);

  return {
    async createUploadForm(input) {
      assertObjectInTenant(input);
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
      const { url, fields } = await createPresignedPost(browser, {
        Bucket: config.bucket,
        Key: input.objectKey,
        Conditions: [
          ["content-length-range", 1, input.maxSizeBytes],
          ["eq", "$Content-Type", input.contentType],
        ],
        Fields: { "Content-Type": input.contentType },
        Expires: input.expiresInSeconds,
      });
      return { url, fields, expiresAt };
    },

    async headObject(input) {
      assertObjectInTenant(input);
      try {
        const head = await server.send(new HeadObjectCommand({ Bucket: config.bucket, Key: input.objectKey }));
        return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async readObjectStart(input) {
      assertObjectInTenant(input);
      const object = await server.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: input.objectKey, Range: `bytes=0-${input.bytes - 1}` }),
      );
      return object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
    },

    async createSignedDownloadUrl(input) {
      assertObjectInTenant(input);
      const url = await getSignedUrl(
        browser,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.objectKey,
          ResponseContentDisposition: attachmentDisposition(input.fileName),
          ResponseContentType: input.contentType,
        }),
        { expiresIn: input.expiresInSeconds },
      );
      return { url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000) };
    },

    async deleteObject(input) {
      assertObjectInTenant(input);
      await server.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: input.objectKey }));
    },
  };
}
