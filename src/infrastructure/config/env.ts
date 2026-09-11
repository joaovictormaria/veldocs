import "server-only";
import { z } from "zod";

/**
 * Configuração de ambiente validada com Zod.
 *
 * - Secrets vêm exclusivamente de variáveis de ambiente (nunca do código).
 * - `APP_ENV` separa o ambiente lógico (development/staging/production) do
 *   `NODE_ENV` do Next.js, permitindo rodar build de produção em staging.
 * - Mensagens de erro citam apenas NOMES de variáveis, nunca valores.
 */

export const APP_ENVIRONMENTS = ["development", "staging", "production"] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

/** Senha usada apenas no docker-compose local; proibida fora de development. */
const LOCAL_DEVELOPMENT_PASSWORD = "veldocs_dev_only";
/** Senha do storage local (MinIO no docker-compose); proibida fora de development. */
const LOCAL_STORAGE_PASSWORD = "veldocs_storage_dev_only";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Chave binária em base64 (as mensagens nunca incluem o valor). */
const base64Key = (description: string, accepts: (bytes: number) => boolean) =>
  z
    .string()
    .regex(BASE64_PATTERN, { error: "deve estar em base64" })
    .refine((value) => accepts(Buffer.from(value, "base64").length), { error: description });

const httpUrl = z.url({ protocol: /^https?$/, error: "deve ser uma URL http(s) válida" });

/** Variáveis do storage: sem nenhuma delas, o upload de arquivos fica desligado. */
const STORAGE_REQUIRED = ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const;

export const envSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVIRONMENTS).default("development"),
    APP_URL: httpUrl,
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "deve ser uma URL PostgreSQL válida",
    }),
    /** AES-256-GCM para dados sensíveis (ex.: CPF). */
    APP_ENCRYPTION_KEY: base64Key("deve ter exatamente 32 bytes", (bytes) => bytes === 32),
    /** HMAC-SHA256 para busca de dados sensíveis e chaves de rate limit. */
    APP_HMAC_KEY: base64Key("deve ter pelo menos 32 bytes", (bytes) => bytes >= 32),

    /**
     * Object storage privado compatível com S3 (FASE 5): Railway Storage Buckets
     * em produção, MinIO no desenvolvimento local e nos testes.
     */
    STORAGE_ENDPOINT: httpUrl.optional(),
    /**
     * Endereço que o NAVEGADOR usa para enviar e baixar arquivos. Só difere de
     * `STORAGE_ENDPOINT` quando o servidor enxerga o storage por outro nome
     * (ex.: `http://storage:9000` dentro do docker-compose).
     */
    STORAGE_PUBLIC_ENDPOINT: httpUrl.optional(),
    STORAGE_REGION: z.string().trim().min(1).default("auto"),
    STORAGE_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, { error: "deve ser um nome de bucket válido" })
      .optional(),
    STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** MinIO usa `http://host/bucket`; o Railway, `https://bucket.host`. */
    STORAGE_FORCE_PATH_STYLE: z
      .enum(["true", "false"], { error: "deve ser true ou false" })
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((env, ctx) => {
    const storageSet = STORAGE_REQUIRED.filter((name) => env[name] !== undefined);
    if (storageSet.length > 0 && storageSet.length < STORAGE_REQUIRED.length) {
      for (const name of STORAGE_REQUIRED.filter((required) => env[required] === undefined)) {
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "obrigatória quando o storage está configurado",
        });
      }
    }

    if (env.APP_ENV === "development") return;

    if (!env.APP_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: `deve usar https em ${env.APP_ENV}`,
      });
    }

    if (env.DATABASE_URL.includes(LOCAL_DEVELOPMENT_PASSWORD)) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: `credenciais locais de desenvolvimento não são permitidas em ${env.APP_ENV}`,
      });
    }

    for (const name of ["STORAGE_ENDPOINT", "STORAGE_PUBLIC_ENDPOINT"] as const) {
      if (env[name] !== undefined && !env[name].startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: [name], message: `deve usar https em ${env.APP_ENV}` });
      }
    }

    if (env.STORAGE_SECRET_ACCESS_KEY === LOCAL_STORAGE_PASSWORD) {
      ctx.addIssue({
        code: "custom",
        path: ["STORAGE_SECRET_ACCESS_KEY"],
        message: `credenciais locais de desenvolvimento não são permitidas em ${env.APP_ENV}`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }

  return result.data;
}

let cachedEnv: Env | undefined;

/** Lê e valida o ambiente do processo uma única vez (lazy). */
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
