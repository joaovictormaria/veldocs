import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/presentation/api-client";
import { LoginForm } from "@/presentation/screens/login-form";
import { currentSession, nextStepFor } from "../_lib/session";

/** Nonce da CSP exige renderização dinâmica (ver src/proxy.ts). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar — VELDOCS" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const destination = safeNextPath(typeof next === "string" ? next : null);

  const session = await currentSession();
  if (session) redirect(destination === "/inicio" ? nextStepFor(session) : destination);

  return <LoginForm next={destination} />;
}
