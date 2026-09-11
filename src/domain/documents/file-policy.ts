/**
 * Política de arquivos dos documentos (MASTER SPEC 7.4 e 8). Tudo que vem do
 * navegador é declaração, não fato: nome, tipo e tamanho são conferidos contra
 * o conteúdo real depois do envio.
 */

/** 25 MB: cobre PDFs escaneados com folga sem virar depósito de vídeos. */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Bytes lidos do início do arquivo para conferir a assinatura. */
export const FILE_SIGNATURE_BYTES = 1024;

export const MAX_FILE_NAME_LENGTH = 160;

/** Proibidos em nomes de arquivo no Windows ou perigosos num cabeçalho de download. */
const FORBIDDEN_NAME_CHARS = ['"', "<", ">", ":", "|", "?", "*"];

/** Abaixo do espaço (32) e o DEL (127): caracteres de controle. */
const isControlChar = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
};

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * Allowlist. Só formatos de documento digitalizado: sem executáveis, sem
 * arquivos compactados e sem formatos de escritório com macros.
 */
export const FILE_TYPES = {
  "application/pdf": {
    label: "PDF",
    extensions: ["pdf"],
    // A especificação do PDF admite bytes antes do cabeçalho, dentro do primeiro 1 KB.
    matches: (bytes: Uint8Array) => {
      const header = ascii("%PDF-");
      const limit = Math.min(bytes.length, FILE_SIGNATURE_BYTES);
      for (let offset = 0; offset + header.length <= limit; offset += 1) {
        if (startsWith(bytes, header, offset)) return true;
      }
      return false;
    },
  },
  "image/jpeg": {
    label: "JPEG",
    extensions: ["jpg", "jpeg"],
    matches: (bytes: Uint8Array) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  "image/png": {
    label: "PNG",
    extensions: ["png"],
    matches: (bytes: Uint8Array) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  "image/webp": {
    label: "WebP",
    extensions: ["webp"],
    matches: (bytes: Uint8Array) => startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8),
  },
} as const;

export type AllowedContentType = keyof typeof FILE_TYPES;

export const ALLOWED_CONTENT_TYPES = Object.keys(FILE_TYPES) as AllowedContentType[];

export function isAllowedContentType(value: string): value is AllowedContentType {
  return Object.hasOwn(FILE_TYPES, value);
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot <= 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** A extensão do nome precisa ser uma das do tipo declarado. */
export function extensionMatchesType(fileName: string, contentType: AllowedContentType): boolean {
  return (FILE_TYPES[contentType].extensions as readonly string[]).includes(extensionOf(fileName));
}

/** O conteúdo real precisa ter a assinatura (magic bytes) do tipo declarado. */
export function contentMatchesType(bytes: Uint8Array, contentType: AllowedContentType): boolean {
  return FILE_TYPES[contentType].matches(bytes);
}

/**
 * Nome exibido e usado no download. Nunca vira caminho nem chave do objeto:
 * diretórios, caracteres de controle e caracteres proibidos saem, e o tamanho
 * é limitado preservando a extensão.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = [...base.normalize("NFC")]
    .filter((char) => !isControlChar(char) && !FORBIDDEN_NAME_CHARS.includes(char))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  if (cleaned === "") return "arquivo";
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned;

  const extension = extensionOf(cleaned);
  const suffix = extension ? `.${extension}` : "";
  return `${cleaned.slice(0, MAX_FILE_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Chave do objeto no bucket: só identificadores internos, nunca o nome
 * original. A empresa é o primeiro segmento — isolamento por prefixo, também
 * conferido por CHECK no banco.
 */
export function buildObjectKey(ids: {
  readonly companyId: string;
  readonly documentId: string;
  readonly fileId: string;
}): string {
  for (const id of [ids.companyId, ids.documentId, ids.fileId]) {
    if (!UUID.test(id)) throw new Error("identificador inválido para a chave do objeto");
  }
  return `companies/${ids.companyId}/documents/${ids.documentId}/files/${ids.fileId}`;
}
