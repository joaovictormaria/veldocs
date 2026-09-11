import { redirect } from "next/navigation";
import { currentSession, landingPath, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

/**
 * Encaminha quem acabou de entrar, se cadastrar ou aceitar um convite:
 * segundo fator pendente → `/seguranca`; empresa sem módulos escolhidos e
 * pessoa que pode escolhê-los → `/builder`; nos demais casos → `/painel`.
 */
export default async function StartPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar");
  if (nextStepFor(session) === "/seguranca") redirect("/seguranca");

  redirect(await landingPath());
}
