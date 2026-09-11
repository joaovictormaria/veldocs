import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/presentation/screens/signup-form";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Criar conta — VELDOCS" };

export default async function SignupPage() {
  const session = await currentSession();
  if (session) redirect(nextStepFor(session));

  return <SignupForm />;
}
