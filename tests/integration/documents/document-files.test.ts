import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createDocumentFileManagement } from "@/application/documents/manage-document-files";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAuditLogger } from "@/infrastructure/database/prisma-audit-logger";
import { createPrismaDocumentFileRepository } from "@/infrastructure/database/prisma-document-file-repository";
import { createTenantFixture, createTestPrismaClient, truncateAllTables } from "../support/database";
import { createTestStorage, postToStorage } from "../support/storage";

const request = { ipAddress: "203.0.113.99", userAgent: "vitest" };

let prisma: PrismaClient;
let storage: ReturnType<typeof createTestStorage>;
let files: ReturnType<typeof createDocumentFileManagement>;
let tenant: Awaited<ReturnType<typeof createTenantFixture>>;
let other: Awaited<ReturnType<typeof createTenantFixture>>;
let context: AuthorizedContext;
let documentId: string;

const pdf = (text = "documento de teste") => new TextEncoder().encode(`%PDF-1.7\n% ${text}\n%%EOF\n`);

const contextFor = (companyId: string, userId: string): AuthorizedContext => ({
  companyId,
  userId,
  roleKeys: ["GESTOR"],
  permissions: ["documents.read", "documents.update"],
});

async function pedir(content: Uint8Array, fileName = "Alvará de funcionamento.pdf", contentType = "application/pdf") {
  const result = await files.requestUpload(context, documentId, { fileName, contentType, sizeBytes: content.length });
  if (!result.ok) throw new Error(`pedido recusado: ${result.reason}`);
  return result.data;
}

beforeAll(() => {
  prisma = createTestPrismaClient();
  storage = createTestStorage();
});

beforeEach(async () => {
  await truncateAllTables(prisma);
  tenant = await createTenantFixture(prisma, `f${randomUUID().slice(0, 4)}`);
  other = await createTenantFixture(prisma, `g${randomUUID().slice(0, 4)}`);
  context = contextFor(tenant.company.id, tenant.user.id);
  documentId = (await prisma.document.create({ data: { companyId: tenant.company.id, title: "Alvará" } })).id;

  files = createDocumentFileManagement({
    repository: createPrismaDocumentFileRepository(prisma),
    storage,
    audit: createPrismaAuditLogger(prisma),
    now: () => new Date(),
    newId: randomUUID,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("arquivos com PostgreSQL e storage S3 real", () => {
  it("envio direto ao bucket, conferência, listagem e download pela URL assinada", async () => {
    const content = pdf();
    const { file, upload } = await pedir(content);

    const envio = await postToStorage(upload, content);
    expect(envio.status, await envio.clone().text()).toBeLessThan(300);

    const concluido = await files.completeUpload(context, documentId, file.id, request);
    expect(concluido).toMatchObject({ ok: true, data: { status: "AVAILABLE", sizeBytes: content.length } });
    expect((await files.list(context, documentId))?.map((item) => item.fileName)).toEqual(["Alvará de funcionamento.pdf"]);

    const download = await files.download(context, documentId, file.id, request);
    if (!download.ok) throw new Error(`download recusado: ${download.reason}`);
    const baixado = await fetch(download.data.url);
    expect(baixado.status).toBe(200);
    expect(new Uint8Array(await baixado.arrayBuffer())).toEqual(content);
    expect(baixado.headers.get("content-disposition")).toContain("filename*=UTF-8''Alvar%C3%A1");

    const acoes = (await prisma.auditLog.findMany({ where: { entityId: file.id }, orderBy: { createdAt: "asc" } })).map(
      (log) => log.action,
    );
    expect(acoes).toEqual(["document_file.uploaded", "document_file.downloaded"]);
  });

  it("conteúdo disfarçado de PDF é recusado e apagado do bucket", async () => {
    const disfarcado = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const { file, upload } = await pedir(disfarcado, "certidao.pdf");
    await postToStorage(upload, disfarcado);

    const result = await files.completeUpload(context, documentId, file.id, request);

    expect(result).toMatchObject({ ok: false, reason: "invalid_input", issues: [{ message: "o conteúdo não é um arquivo PDF válido" }] });
    const row = await prisma.documentFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(row).toMatchObject({ status: "REJECTED", rejectionReason: "o conteúdo não é um arquivo PDF válido" });
    expect(await storage.headObject({ companyId: tenant.company.id, objectKey: row.objectKey })).toBeNull();
  });

  it("a política assinada impede trocar o tipo do arquivo no envio", async () => {
    const content = pdf();
    const { upload } = await pedir(content);

    const trocado = await postToStorage(upload, content, { contentType: "text/html" });

    expect(trocado.status).toBe(403);
  });

  it("concluir antes do envio avisa e mantém pendente", async () => {
    const { file } = await pedir(pdf());

    expect(await files.completeUpload(context, documentId, file.id, request)).toMatchObject({
      ok: false,
      issues: [{ message: "o arquivo ainda não chegou ao armazenamento" }],
    });
    expect((await prisma.documentFile.findUniqueOrThrow({ where: { id: file.id } })).status).toBe("PENDING");
  });

  it("excluir tira do documento, mas o objeto continua guardado", async () => {
    const content = pdf();
    const { file, upload } = await pedir(content);
    await postToStorage(upload, content);
    await files.completeUpload(context, documentId, file.id, request);

    expect(await files.remove(context, documentId, file.id, request)).toEqual({ ok: true, data: null });

    expect(await files.list(context, documentId)).toEqual([]);
    const row = await prisma.documentFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(await storage.headObject({ companyId: tenant.company.id, objectKey: row.objectKey })).toMatchObject({
      sizeBytes: content.length,
    });
  });

  it("outra empresa não alcança o arquivo nem pela aplicação nem pelo storage", async () => {
    const content = pdf();
    const { file, upload } = await pedir(content);
    await postToStorage(upload, content);
    await files.completeUpload(context, documentId, file.id, request);
    const objectKey = (await prisma.documentFile.findUniqueOrThrow({ where: { id: file.id } })).objectKey;

    const intruso = contextFor(other.company.id, other.user.id);
    expect(await files.list(intruso, documentId)).toBeNull();
    expect(await files.download(intruso, documentId, file.id, request)).toEqual({ ok: false, reason: "not_found" });
    expect(await files.remove(intruso, documentId, file.id, request)).toEqual({ ok: false, reason: "not_found" });

    // Mesmo com a chave em mãos, o adaptador recusa o prefixo de outra empresa.
    await expect(storage.headObject({ companyId: other.company.id, objectKey })).rejects.toThrow(
      "chave de objeto fora do prefixo da empresa",
    );
  });

  it("o banco recusa chave de objeto que não pertence à linha", async () => {
    const id = randomUUID();
    await expect(
      prisma.documentFile.create({
        data: {
          id,
          companyId: tenant.company.id,
          documentId,
          objectKey: `companies/${other.company.id}/documents/${documentId}/files/${id}`,
          fileName: "invasor.pdf",
          contentType: "application/pdf",
          sizeBytes: 10,
          uploadedById: tenant.user.id,
          uploadExpiresAt: new Date(),
        },
      }),
    ).rejects.toThrow(/document_files_object_key_matches_ids_chk/);
  });
});
