import { redirect } from "next/navigation";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

/** Encaminha para o próximo passo de quem acabou de entrar, se cadastrar ou aceitar um convite. */
export default async function StartPage() {
  const session = await currentSession();
  redirect(session ? nextStepFor(session) : "/entrar");
}
