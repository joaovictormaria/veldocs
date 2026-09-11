"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { api, errorMessage } from "@/presentation/api-client";
import { Alert, AuthCard, Button, Field, LINK_CLASS } from "@/presentation/components/ui";

export function LoginForm({ next }: { readonly next: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await api("/api/auth/login", { method: "POST", body: { identifier, password } });
    if (!result.ok) {
      setBusy(false);
      setError(
        result.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
          : errorMessage(result.error, "E-mail, CPF ou senha incorretos."),
      );
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <AuthCard title="Entrar" subtitle="Acesse a documentação da sua empresa.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          id="identifier"
          label="E-mail ou CPF"
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
        <Field
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" loading={busy}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className={LINK_CLASS}>
          Criar conta
        </Link>
      </p>
    </AuthCard>
  );
}
