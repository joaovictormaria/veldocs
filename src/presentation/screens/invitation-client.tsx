"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { api, errorMessage, fieldErrors } from "@/presentation/api-client";
import { Alert, AuthCard, Button, Field, LINK_CLASS } from "@/presentation/components/ui";
import { formatDate } from "@/presentation/format";

export interface InvitationView {
  readonly companyName: string;
  /** Já mascarado pelo servidor. */
  readonly email: string;
  readonly roleName: string;
  readonly expiresAt: string;
}

export function InvitationClient({
  token,
  invitation,
  signedInEmail,
}: {
  readonly token: string;
  readonly invitation: InvitationView | null;
  readonly signedInEmail: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", password: "", cpf: "" });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!invitation) {
    return (
      <AuthCard title="Convite indisponível">
        <Alert tone="info">
          Este convite pode ter expirado, sido revogado ou já usado. Peça um novo convite a quem convidou você.
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/entrar" className={LINK_CLASS}>
            Ir para o login
          </Link>
        </p>
      </AuthCard>
    );
  }

  const finish = () => {
    router.push("/inicio");
    router.refresh();
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    const result = await api(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
    if (!result.ok) {
      setBusy(false);
      setError(errorMessage(result.error, "Não foi possível aceitar o convite."));
      return;
    }
    finish();
  };

  const signup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssues({});
    const result = await api(`/api/invitations/${encodeURIComponent(token)}/signup`, { method: "POST", body: form });
    if (!result.ok) {
      setBusy(false);
      const byField = fieldErrors(result.error);
      setIssues(byField);
      if (Object.keys(byField).length === 0) setError(errorMessage(result.error, "Não foi possível criar a conta."));
      return;
    }
    finish();
  };

  const switchAccount = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.refresh();
  };

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <AuthCard
      title={`Convite para ${invitation.companyName}`}
      subtitle={`Perfil ${invitation.roleName} · para ${invitation.email} · válido até ${formatDate(invitation.expiresAt)}`}
    >
      {signedInEmail ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Você entrou como <strong>{signedInEmail}</strong>.
          </p>
          {error ? <Alert>{error}</Alert> : null}
          <Button className="w-full" loading={busy} onClick={accept}>
            Aceitar convite
          </Button>
          <Button variant="ghost" className="w-full" onClick={switchAccount}>
            Sair e usar outra conta
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={signup} className="space-y-4" noValidate>
            <Field id="name" label="Seu nome" autoComplete="name" value={form.name} onChange={update("name")} error={issues.name} required />
            <Field
              id="password"
              label="Crie uma senha"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              error={issues.password}
              hint="Use uma frase longa que você consiga lembrar."
              required
            />
            <Field id="cpf" label="CPF (opcional)" inputMode="numeric" value={form.cpf} onChange={update("cpf")} error={issues.cpf} />
            {error ? <Alert>{error}</Alert> : null}
            <Button type="submit" className="w-full" loading={busy}>
              Entrar na empresa
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Já tem conta?{" "}
            <Link href={`/entrar?next=${encodeURIComponent(`/convite/${token}`)}`} className={LINK_CLASS}>
              Entre para aceitar
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  );
}
