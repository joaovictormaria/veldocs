import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/** Token aleatório de uso em cookies e links (256 bits por padrão), em base64url. */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * HMAC-SHA256 determinístico para busca/unicidade de dados sensíveis (ex.: CPF)
 * sem armazená-los em claro. Sem a chave, o valor não pode ser testado por força
 * bruta a partir do banco.
 */
export function createLookupHasher(key: Uint8Array): (value: string) => string {
  if (key.length < 32) throw new Error("a chave de HMAC deve ter pelo menos 32 bytes");
  return (value) => createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export interface FieldEncryptor {
  encrypt(plaintext: string): string;
  decrypt(payload: string): string;
}

const FORMAT_VERSION = "v1";
const IV_BYTES = 12;

/**
 * AES-256-GCM com formato versionado `v1.<iv>.<tag>.<ciphertext>` (base64url).
 * `context` entra como dado autenticado (AAD): um valor cifrado para um campo
 * não pode ser copiado para outro campo sem falhar na decifragem.
 */
export function createFieldEncryptor(key: Uint8Array, context: string): FieldEncryptor {
  if (key.length !== 32) throw new Error("a chave de criptografia deve ter exatamente 32 bytes");
  const aad = Buffer.from(context, "utf8");

  return {
    encrypt(plaintext) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return [FORMAT_VERSION, iv, cipher.getAuthTag(), ciphertext]
        .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
        .join(".");
    },
    decrypt(payload) {
      const [version, iv, tag, ciphertext, ...rest] = payload.split(".");
      if (version !== FORMAT_VERSION || !iv || !tag || ciphertext === undefined || rest.length > 0) {
        throw new Error("formato de dado cifrado inválido");
      }
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    },
  };
}
