"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { api, errorMessage, fieldErrors } from "@/presentation/api-client";
import { Alert, AuthCard, Button, Field, LINK_CLASS } from "@/presentation/components/ui";

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", cpf: "", companyName: "" });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssues({});

    const result = await api("/api/auth/signup", { method: "POST", body: form });
    if (!result.ok) {
      setBusy(false);
      const byField = fieldErrors(result.error);
      setIssues(byField);
      if (Object.keys(byField).length === 0) {
        setError(
          result.status === 429
            ? "Muitas tentativas. Aguarde e tente de novo."
            : errorMessage(result.error, "Não foi possível criar a conta."),
        );
      }
      return;
    }

    // Proprietário precisa do segundo fator antes de usar a empresa.
    router.push("/seguranca");
    router.refresh();
  };

  return (
    <AuthCard title="Criar conta" subtitle="Monte o VELDOCS da sua empresa e teste grátis por 14 dias.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="name" label="Seu nome" autoComplete="name" value={form.name} onChange={update("name")} error={issues.name} required />
        <Field
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          error={issues.email}
          required
        />
        <Field
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          error={issues.password}
          hint="Use uma frase longa que você consiga lembrar."
          required
        />
        <Field id="cpf" label="CPF (opcional)" inputMode="numeric" value={form.cpf} onChange={update("cpf")} error={issues.cpf} />
        <Field
          id="companyName"
          label="Nome da empresa"
          autoComplete="organization"
          value={form.companyName}
          onChange={update("companyName")}
          error={issues.companyName}
          required
        />
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Já tem conta?{" "}
        <Link href="/entrar" className={LINK_CLASS}>
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
