import { beforeEach, describe, expect, it } from "vitest";
import type { AuthorizedContext } from "@/application/access/authorize";
import { createDocumentFileManagement } from "@/application/documents/manage-document-files";
import type {
  DocumentFileRecord,
  DocumentFileRepository,
  NewDocumentFile,
} from "@/application/ports/document-file-repository";
import { assertObjectInTenant, type StorageProvider } from "@/application/ports/storage-provider";
import { MAX_FILE_SIZE_BYTES } from "@/domain/documents/file-policy";
import { createFakeAudit, createFakeClock } from "../auth/fakes";

const COMPANY = "0199a1b2-0000-4000-8000-00000000000a";
const DOCUMENT = "0199a1b2-0000-4000-8000-00000000000b";
const FILE_ID = "0199a1b2-0000-4000-8000-00000000000c";
const request = { ipAddress: "203.0.113.20", userAgent: "vitest" };

const context: AuthorizedContext = {
  companyId: COMPANY,
  userId: "user-1",
  roleKeys: ["GESTOR"],
  permissions: ["documents.read", "documents.update"],
};

const pdfBytes = (size: number) => {
  const content = new Uint8Array(size).fill(32);
  content.set([...("%PDF-1.7")].map((char) => char.charCodeAt(0)), 0);
  return content;
};

function createFakes() {
  const files = new Map<string, DocumentFileRecord & { companyId: string; deletedAt: Date | null; rejectionReason?: string }>();
  const objects = new Map<string, Uint8Array>();
  const calls: string[] = [];

  const repository: DocumentFileRepository = {
    async documentExists(companyId, documentId) {
      return companyId === COMPANY && documentId === DOCUMENT;
    },
    async createPending(file: NewDocumentFile) {
      const record = {
        id: file.id,
        companyId: file.companyId,
        documentId: file.documentId,
        objectKey: file.objectKey,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        status: "PENDING" as const,
        uploadedBy: { userId: file.uploadedById, name: "Pessoa" },
        uploadExpiresAt: file.uploadExpiresAt,
        availableAt: null,
        createdAt: new Date(),
        deletedAt: null,
      };
      files.set(file.id, record);
      return record;
    },
    async findFile(companyId, documentId, fileId) {
      const file = files.get(fileId);
      return file && file.companyId === companyId && file.documentId === documentId && !file.deletedAt ? file : null;
    },
    async markAvailable(companyId, fileId, at) {
      const file = files.get(fileId);
      if (!file || file.companyId !== companyId || file.status !== "PENDING") return null;
      const updated = { ...file, status: "AVAILABLE" as const, availableAt: at };
      files.set(fileId, updated);
      return updated;
    },
    async markRejected(companyId, fileId, reason) {
      const file = files.get(fileId);
      if (file && file.companyId === companyId) files.set(fileId, { ...file, status: "REJECTED", rejectionReason: reason });
    },
    async listAvailable(companyId, documentId) {
      return [...files.values()].filter(
        (file) => file.companyId === companyId && file.documentId === documentId && file.status === "AVAILABLE" && !file.deletedAt,
      );
    },
    async softDelete(companyId, documentId, fileId, at) {
      const file = await repository.findFile(companyId, documentId, fileId);
      if (!file) return false;
      files.set(fileId, { ...(files.get(fileId) as typeof file & { companyId: string }), deletedAt: at });
      return true;
    },
  };

  // Storage falso que respeita a mesma regra de prefixo por empresa do real.
  const storage: StorageProvider = {
    async createUploadForm(input) {
      assertObjectInTenant(input);
      calls.push(`upload:${input.objectKey}`);
      return { url: "https://storage.test/bucket", fields: { key: input.objectKey }, expiresAt: new Date("2026-09-11T12:10:00.000Z") };
    },
    async headObject(input) {
      assertObjectInTenant(input);
      const object = objects.get(input.objectKey);
      return object ? { sizeBytes: object.length, contentType: null } : null;
    },
    async readObjectStart(input) {
      assertObjectInTenant(input);
      return (objects.get(input.objectKey) ?? new Uint8Array()).slice(0, input.bytes);
    },
    async createSignedDownloadUrl(input) {
      assertObjectInTenant(input);
      return { url: `https://storage.test/${input.objectKey}?assinado`, expiresAt: new Date("2026-09-11T12:05:00.000Z") };
    },
    async deleteObject(input) {
      assertObjectInTenant(input);
      calls.push(`delete:${input.objectKey}`);
      objects.delete(input.objectKey);
    },
  };

  return { repository, storage, files, objects, calls };
}

let fakes: ReturnType<typeof createFakes>;
let audit: ReturnType<typeof createFakeAudit>;
let files: ReturnType<typeof createDocumentFileManagement>;

const setup = (storage: StorageProvider | null) =>
  createDocumentFileManagement({
    repository: fakes.repository,
    storage,
    audit: audit.audit,
    now: createFakeClock().now,
    newId: () => FILE_ID,
  });

const pedido = { fileName: "Alvará de funcionamento.pdf", contentType: "application/pdf", sizeBytes: 2048 };

async function pedirEnvio() {
  const result = await files.requestUpload(context, DOCUMENT, pedido);
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.reason}`);
  return result.data;
}

beforeEach(() => {
  fakes = createFakes();
  audit = createFakeAudit();
  files = setup(fakes.storage);
});

describe("pedido de envio", () => {
  it("emite o formulário assinado com chave interna, sem auditar ainda", async () => {
    const { file, upload } = await pedirEnvio();

    const objectKey = `companies/${COMPANY}/documents/${DOCUMENT}/files/${FILE_ID}`;
    expect(fakes.calls).toEqual([`upload:${objectKey}`]);
    expect(upload.fields).toEqual({ key: objectKey });
    expect(file).toMatchObject({ id: FILE_ID, status: "PENDING", fileName: "Alvará de funcionamento.pdf" });
    // A chave interna não sai para o navegador pela resposta do arquivo.
    expect(file).not.toHaveProperty("objectKey");
    expect(audit.events).toEqual([]);
  });

  it("recusa tipo fora da lista, tamanho acima do limite e extensão trocada", async () => {
    const casos = [
      [{ ...pedido, contentType: "application/zip", fileName: "pacote.zip" }, "contentType"],
      [{ ...pedido, sizeBytes: MAX_FILE_SIZE_BYTES + 1 }, "sizeBytes"],
      [{ ...pedido, sizeBytes: 0 }, "sizeBytes"],
      [{ ...pedido, fileName: "alvara.exe" }, "fileName"],
    ] as const;

    for (const [input, field] of casos) {
      const result = await files.requestUpload(context, DOCUMENT, input);
      if (result.ok || result.reason !== "invalid_input") throw new Error("esperava recusa por validação");
      expect(result.issues.map((issue) => issue.field), field).toContain(field);
    }
    expect(fakes.files.size).toBe(0);
  });

  it("documento de outra empresa ou inexistente é not_found", async () => {
    expect(await files.requestUpload(context, "0199a1b2-0000-4000-8000-0000000000ff", pedido)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("sem storage configurado responde indisponível sem gravar nada", async () => {
    files = setup(null);
    expect(await files.requestUpload(context, DOCUMENT, pedido)).toEqual({ ok: false, reason: "storage_unavailable" });
    expect(files.isEnabled()).toBe(false);
    expect(fakes.files.size).toBe(0);
  });
});

describe("conclusão do envio", () => {
  it("arquivo que confere fica disponível e é auditado uma vez só", async () => {
    const { file } = await pedirEnvio();
    fakes.objects.set(fakes.files.get(file.id)?.objectKey as string, pdfBytes(2048));

    const primeiro = await files.completeUpload(context, DOCUMENT, file.id, request);
    const segundo = await files.completeUpload(context, DOCUMENT, file.id, request);

    expect(primeiro).toMatchObject({ ok: true, data: { status: "AVAILABLE" } });
    expect(segundo).toMatchObject({ ok: true, data: { status: "AVAILABLE" } });
    expect(audit.events.map((event) => event.action)).toEqual(["document_file.uploaded"]);
    expect(audit.events[0]).toMatchObject({
      entityType: "DocumentFile",
      entityId: file.id,
      metadata: { documentId: DOCUMENT, contentType: "application/pdf", sizeBytes: 2048 },
    });
  });

  it("antes de o arquivo chegar ao bucket, avisa e continua pendente", async () => {
    const { file } = await pedirEnvio();

    const result = await files.completeUpload(context, DOCUMENT, file.id, request);

    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      issues: [{ field: "file", message: "o arquivo ainda não chegou ao armazenamento" }],
    });
    expect(fakes.files.get(file.id)?.status).toBe("PENDING");
  });

  it("tamanho diferente do informado: recusa e apaga o objeto", async () => {
    const { file } = await pedirEnvio();
    const key = fakes.files.get(file.id)?.objectKey as string;
    fakes.objects.set(key, pdfBytes(4096));

    const result = await files.completeUpload(context, DOCUMENT, file.id, request);

    expect(result).toMatchObject({ ok: false, reason: "invalid_input", issues: [{ message: "o tamanho recebido é diferente do informado" }] });
    expect(fakes.objects.has(key)).toBe(false);
    expect(fakes.files.get(file.id)?.status).toBe("REJECTED");
    expect(audit.events.map((event) => event.action)).toEqual(["document_file.rejected"]);
  });

  it("conteúdo que não é PDF, mesmo com nome e tipo de PDF: recusa e apaga", async () => {
    const { file } = await pedirEnvio();
    const key = fakes.files.get(file.id)?.objectKey as string;
    const disfarcado = new Uint8Array(2048).fill(65);
    disfarcado.set([0x4d, 0x5a], 0);
    fakes.objects.set(key, disfarcado);

    const result = await files.completeUpload(context, DOCUMENT, file.id, request);

    expect(result).toMatchObject({ ok: false, issues: [{ message: "o conteúdo não é um arquivo PDF válido" }] });
    expect(fakes.objects.has(key)).toBe(false);
    // Recusado não pode ser concluído de novo.
    expect(await files.completeUpload(context, DOCUMENT, file.id, request)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("download e exclusão", () => {
  async function arquivoDisponivel() {
    const { file } = await pedirEnvio();
    const key = fakes.files.get(file.id)?.objectKey as string;
    fakes.objects.set(key, pdfBytes(2048));
    await files.completeUpload(context, DOCUMENT, file.id, request);
    audit.events.length = 0;
    return { file, key };
  }

  it("arquivo pendente não pode ser baixado", async () => {
    const { file } = await pedirEnvio();
    expect(await files.download(context, DOCUMENT, file.id, request)).toEqual({ ok: false, reason: "not_found" });
  });

  it("download devolve URL assinada e fica na auditoria", async () => {
    const { file, key } = await arquivoDisponivel();

    const result = await files.download(context, DOCUMENT, file.id, request);

    expect(result).toMatchObject({ ok: true, data: { url: `https://storage.test/${key}?assinado` } });
    expect(audit.events.map((event) => event.action)).toEqual(["document_file.downloaded"]);
  });

  it("excluir tira o arquivo do documento, mas não apaga o objeto do bucket", async () => {
    const { file, key } = await arquivoDisponivel();

    expect(await files.remove(context, DOCUMENT, file.id, request)).toEqual({ ok: true, data: null });

    expect(await files.list(context, DOCUMENT)).toEqual([]);
    expect(fakes.objects.has(key)).toBe(true);
    expect(fakes.calls.some((call) => call.startsWith("delete:"))).toBe(false);
    expect(audit.events.map((event) => event.action)).toEqual(["document_file.deleted"]);
  });

  it("listagem de documento inexistente é nula", async () => {
    expect(await files.list(context, "0199a1b2-0000-4000-8000-0000000000ff")).toBeNull();
  });
});
