import { getEnv } from "@/infrastructure/config/env";

/**
 * Log estruturado em JSON (uma linha por evento), com nível configurável por
 * `LOG_LEVEL`. Campos sensíveis são redigidos automaticamente: nunca registrar
 * senha, token, segredo, CPF ou e-mail digitado.
 */
export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Readonly<Record<string, LogValue>>;

const SENSITIVE_FIELD = /(password|senha|token|secret|segredo|cpf|authorization|cookie|code)/i;
export const REDACTED = "[redigido]";

export function redactFields(fields: LogFields): Record<string, LogValue> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, SENSITIVE_FIELD.test(key) ? REDACTED : value]),
  );
}

export interface Logger extends Record<LogLevel, (message: string, fields?: LogFields) => void> {
  readonly level: LogLevel;
}

export function createJsonLogger(options: {
  readonly level: LogLevel;
  readonly write?: (line: string) => void;
  readonly now?: () => Date;
}): Logger {
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const log = (level: LogLevel) => (message: string, fields: LogFields = {}) => {
    if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[options.level]) return;
    write(JSON.stringify({ level, time: now().toISOString(), message, ...redactFields(fields) }));
  };

  return {
    level: options.level,
    fatal: log("fatal"),
    error: log("error"),
    warn: log("warn"),
    info: log("info"),
    debug: log("debug"),
    trace: log("trace"),
  };
}

let cachedLogger: Logger | undefined;

export function getLogger(): Logger {
  cachedLogger ??= createJsonLogger({ level: getEnv().LOG_LEVEL });
  return cachedLogger;
}

/** Id de requisição propagado pelo proxy (`src/proxy.ts`). */
export function requestId(request: Request): string | undefined {
  return request.headers.get("x-request-id") ?? undefined;
}
