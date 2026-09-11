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

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Chave binária em base64 (as mensagens nunca incluem o valor). */
const base64Key = (description: string, accepts: (bytes: number) => boolean) =>
  z
    .string()
    .regex(BASE64_PATTERN, { error: "deve estar em base64" })
    .refine((value) => accepts(Buffer.from(value, "base64").length), { error: description });

export const envSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVIRONMENTS).default("development"),
    APP_URL: z.url({ protocol: /^https?$/, error: "deve ser uma URL http(s) válida" }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "deve ser uma URL PostgreSQL válida",
    }),
    /** AES-256-GCM para dados sensíveis (ex.: CPF). */
    APP_ENCRYPTION_KEY: base64Key("deve ter exatamente 32 bytes", (bytes) => bytes === 32),
    /** HMAC-SHA256 para busca de dados sensíveis e chaves de rate limit. */
    APP_HMAC_KEY: base64Key("deve ter pelo menos 32 bytes", (bytes) => bytes >= 32),
  })
  .superRefine((env, ctx) => {
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
