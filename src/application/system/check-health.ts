import type { HealthProbe } from "@/application/ports/health-probe";

export type ComponentStatus = "up" | "down";

export interface HealthReport {
  readonly status: "ok" | "degraded";
  readonly checks: Readonly<Record<string, ComponentStatus>>;
}

const DEFAULT_TIMEOUT_MS = 2_000;

/**
 * Executa as verificações em paralelo, cada uma com timeout.
 * O relatório expõe apenas "up"/"down" — nunca mensagens de erro internas.
 */
export async function checkHealth(
  probes: readonly HealthProbe[],
  options: { readonly timeoutMs?: number } = {},
): Promise<HealthReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const results = await Promise.all(
    probes.map(async (probe) => [probe.name, await runProbe(probe, timeoutMs)] as const),
  );

  return {
    status: results.every(([, status]) => status === "up") ? "ok" : "degraded",
    checks: Object.fromEntries(results),
  };
}

async function runProbe(probe: HealthProbe, timeoutMs: number): Promise<ComponentStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${probe.name}`)), timeoutMs);
  });

  try {
    await Promise.race([probe.check(), timeout]);
    return "up";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}
