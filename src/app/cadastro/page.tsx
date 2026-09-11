import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/presentation/screens/signup-form";
import { currentSession } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Criar conta — VELDOCS" };

export default async function SignupPage() {
  // Quem já entrou não cria outra conta: `/inicio` decide o próximo passo.
  const session = await currentSession();
  if (session) redirect("/inicio");

  return <SignupForm />;
}
