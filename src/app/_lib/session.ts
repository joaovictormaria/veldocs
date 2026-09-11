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
