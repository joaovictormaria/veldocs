import { describe, expect, it } from "vitest";
import {
  ALLOWED_CONTENT_TYPES,
  buildObjectKey,
  contentMatchesType,
  extensionMatchesType,
  isAllowedContentType,
  MAX_FILE_NAME_LENGTH,
  MAX_FILE_SIZE_BYTES,
  sanitizeFileName,
} from "@/domain/documents/file-policy";

const bytes = (...parts: Array<string | number[]>) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part)));

const BACKSLASH = String.fromCharCode(92);
const COMPANY = "0199a1b2-0000-4000-8000-000000000001";
const DOCUMENT = "0199a1b2-0000-4000-8000-000000000002";
const FILE = "0199a1b2-0000-4000-8000-000000000003";

describe("tipos aceitos", () => {
  it("só documentos digitalizados: PDF e imagens comuns", () => {
    expect(ALLOWED_CONTENT_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    for (const type of ["application/zip", "text/html", "image/svg+xml", "application/x-msdownload", ""]) {
      expect(isAllowedContentType(type), type).toBe(false);
    }
  });

  it("limite de 25 MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(26_214_400);
  });

  it("a extensão precisa combinar com o tipo declarado", () => {
    expect(extensionMatchesType("Alvará.PDF", "application/pdf")).toBe(true);
    expect(extensionMatchesType("foto.jpg", "image/jpeg")).toBe(true);
    expect(extensionMatchesType("foto.jpeg", "image/jpeg")).toBe(true);
    expect(extensionMatchesType("virus.exe", "application/pdf")).toBe(false);
    expect(extensionMatchesType("alvara.pdf.exe", "application/pdf")).toBe(false);
    expect(extensionMatchesType("sem-extensao", "application/pdf")).toBe(false);
    expect(extensionMatchesType(".pdf", "application/pdf")).toBe(false);
  });
});

describe("assinatura do conteúdo (magic bytes)", () => {
  it("reconhece cada formato pelo que realmente está no arquivo", () => {
    expect(contentMatchesType(bytes("%PDF-1.7", [10]), "application/pdf")).toBe(true);
    expect(contentMatchesType(bytes([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(contentMatchesType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(contentMatchesType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "image/webp")).toBe(true);
  });

  it("aceita o cabeçalho do PDF depois de bytes iniciais, dentro do primeiro 1 KB", () => {
    expect(contentMatchesType(bytes(new Array(100).fill(32), "%PDF-1.4"), "application/pdf")).toBe(true);
    expect(contentMatchesType(bytes(new Array(1100).fill(32), "%PDF-1.4"), "application/pdf")).toBe(false);
  });

  it("recusa conteúdo que não é do tipo declarado", () => {
    expect(contentMatchesType(bytes("<html><script>"), "application/pdf")).toBe(false);
    expect(contentMatchesType(bytes([0xff, 0xd8, 0xff, 0xe0]), "image/png")).toBe(false);
    expect(contentMatchesType(bytes("MZ", [0x90, 0x00]), "image/jpeg")).toBe(false);
    expect(contentMatchesType(bytes("RIFF", [0, 0, 0, 0], "WAVE"), "image/webp")).toBe(false);
    expect(contentMatchesType(new Uint8Array(), "application/pdf")).toBe(false);
  });
});

describe("nome do arquivo", () => {
  it("descarta diretórios, inclusive no formato do Windows", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName(["C:", "Users", "joana", "alvara.pdf"].join(BACKSLASH))).toBe("alvara.pdf");
  });

  it("remove caracteres de controle e proibidos, mantendo espaços e acentos", () => {
    expect(sanitizeFileName(`ali${String.fromCharCode(0)}var${String.fromCharCode(127)}á.pdf`)).toBe("alivará.pdf");
    expect(sanitizeFileName('Certidão "negativa" <2026>?.pdf')).toBe("Certidão negativa 2026.pdf");
    expect(sanitizeFileName("  Alvará   de   funcionamento.pdf ")).toBe("Alvará de funcionamento.pdf");
  });

  it("não deixa nome oculto nem vazio", () => {
    expect(sanitizeFileName("...pdf")).toBe("pdf");
    expect(sanitizeFileName("   ")).toBe("arquivo");
    expect(sanitizeFileName('"<>|')).toBe("arquivo");
  });

  it("limita o tamanho preservando a extensão", () => {
    const name = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBe(MAX_FILE_NAME_LENGTH);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("chave do objeto no bucket", () => {
  it("é feita só de identificadores, com a empresa como prefixo", () => {
    expect(buildObjectKey({ companyId: COMPANY, documentId: DOCUMENT, fileId: FILE })).toBe(
      `companies/${COMPANY}/documents/${DOCUMENT}/files/${FILE}`,
    );
  });

  it("recusa qualquer coisa que não seja uuid (sem caminho injetado)", () => {
    expect(() => buildObjectKey({ companyId: COMPANY, documentId: "../outra-empresa", fileId: FILE })).toThrow();
    expect(() => buildObjectKey({ companyId: "*", documentId: DOCUMENT, fileId: FILE })).toThrow();
  });
});
