import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "@/presentation/screens/mfa-form";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verificação em duas etapas — VELDOCS" };

export default async function SecurityPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/seguranca");
  if (nextStepFor(session) !== "/seguranca") redirect("/builder");

  return <MfaForm mode={session.mfa.configured ? "verify" : "enroll"} />;
}
