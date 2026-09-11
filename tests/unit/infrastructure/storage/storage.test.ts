import { describe, expect, it } from "vitest";
import { assertObjectInTenant, ObjectKeyOutsideTenantError } from "@/application/ports/storage-provider";
import { parseEnv } from "@/infrastructure/config/env";
import { attachmentDisposition } from "@/infrastructure/storage/s3-storage-provider";
import { storageBrowserOrigin, storageConfigFrom } from "@/infrastructure/storage/storage-config";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://veldocs:veldocs_dev_only@127.0.0.1:5440/veldocs_dev",
  APP_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
  APP_HMAC_KEY: Buffer.from("fedcba9876543210fedcba9876543210").toString("base64"),
};

const storage = {
  STORAGE_ENDPOINT: "https://storage.railway.example",
  STORAGE_BUCKET: "veldocs-arquivos",
  STORAGE_ACCESS_KEY_ID: "id",
  STORAGE_SECRET_ACCESS_KEY: "segredo",
};

describe("configuração do storage", () => {
  it("fica desligada sem as variáveis", () => {
    expect(storageConfigFrom(parseEnv(base))).toBeNull();
  });

  it("usa o mesmo endereço para servidor e navegador quando não há endereço público próprio", () => {
    expect(storageConfigFrom(parseEnv({ ...base, ...storage }))).toMatchObject({
      endpoint: "https://storage.railway.example",
      publicEndpoint: "https://storage.railway.example",
      region: "auto",
      forcePathStyle: false,
    });
  });

  it("no docker-compose o servidor e o navegador enxergam endereços diferentes", () => {
    const config = storageConfigFrom(
      parseEnv({
        ...base,
        ...storage,
        STORAGE_ENDPOINT: "http://storage:9000",
        STORAGE_PUBLIC_ENDPOINT: "http://127.0.0.1:9010",
        STORAGE_FORCE_PATH_STYLE: "true",
      }),
    );
    expect(config).toMatchObject({ endpoint: "http://storage:9000", publicEndpoint: "http://127.0.0.1:9010" });
  });

  it("a origem liberada na CSP acompanha o estilo de endereço", () => {
    const railway = storageConfigFrom(parseEnv({ ...base, ...storage }));
    expect(railway && storageBrowserOrigin(railway)).toBe("https://veldocs-arquivos.storage.railway.example");

    const minio = storageConfigFrom(
      parseEnv({ ...base, ...storage, STORAGE_ENDPOINT: "http://127.0.0.1:9010", STORAGE_FORCE_PATH_STYLE: "true" }),
    );
    expect(minio && storageBrowserOrigin(minio)).toBe("http://127.0.0.1:9010");
  });
});

describe("isolamento das chaves por empresa", () => {
  it("só aceita chaves no prefixo da própria empresa", () => {
    expect(() => assertObjectInTenant({ companyId: "empresa-a", objectKey: "companies/empresa-a/documents/x" })).not.toThrow();
    expect(() => assertObjectInTenant({ companyId: "empresa-a", objectKey: "companies/empresa-b/documents/x" })).toThrow(
      ObjectKeyOutsideTenantError,
    );
    // Prefixo parecido não engana a checagem.
    expect(() => assertObjectInTenant({ companyId: "empresa-a", objectKey: "companies/empresa-ab/documents/x" })).toThrow();
  });
});

describe("nome no download", () => {
  it("manda um nome ASCII de reserva e o nome completo em UTF-8", () => {
    expect(attachmentDisposition("Alvará 2026.pdf")).toBe(
      "attachment; filename=\"Alvar_ 2026.pdf\"; filename*=UTF-8''Alvar%C3%A1%202026.pdf",
    );
  });
});
