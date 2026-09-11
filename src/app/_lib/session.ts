import "server-only";
import type { CurrentSession } from "@/application/auth/session-use-cases";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";

/** Sessão de quem abriu a página (pasta privada `_lib`: não vira rota). */
export async function currentSession(): Promise<CurrentSession | null> {
  return getAuthServices().getCurrentSession(await readSessionToken(getEnv().APP_URL));
}

/** Próxima tela de quem já entrou: segundo fator pendente ou o Builder. */
export function nextStepFor(session: CurrentSession): "/seguranca" | "/builder" {
  const { required, configured, verified } = session.mfa;
  return required && !(configured && verified) ? "/seguranca" : "/builder";
}

/**
 * Onde a pessoa começa depois de entrar: o Builder enquanto a empresa ainda
 * não escolheu os módulos (e só para quem pode escolher); nos demais casos, o
 * painel. Quem não gerencia a assinatura nunca cai numa tela que não pode usar.
 */
export async function landingPath(): Promise<"/builder" | "/painel"> {
  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "billing.manage");
  if (!authorization.ok) return "/painel";

  const subscription = await services.subscriptions.getSummary(authorization.context);
  return subscription.status === "NOT_STARTED" ? "/builder" : "/painel";
}
