"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { api, errorMessage } from "@/presentation/api-client";
import { Alert, AuthCard, Button, Field, LINK_CLASS } from "@/presentation/components/ui";

/**
 * Segundo fator. A chave só é gerada quando a pessoa pede: gerar ao abrir a
 * tela poderia disparar duas vezes e exibir uma chave diferente da gravada.
 */
export function MfaForm({ mode: initialMode }: { readonly mode: "enroll" | "verify" }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [secret, setSecret] = useState<string | null>(null);
  const [keyUri, setKeyUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const continueToBuilder = () => {
    router.push("/builder");
    router.refresh();
  };

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    const result = await api<{ secret: string; keyUri: string }>("/api/auth/mfa/enroll", { method: "POST" });
    setBusy(false);

    if (result.ok) {
      setSecret(result.data.secret);
      setKeyUri(result.data.keyUri);
      return;
    }
    if (result.error.error === "mfa_already_enabled") {
      setMode("verify");
      return;
    }
    setError(errorMessage(result.error, "Não foi possível iniciar a configuração."));
  };

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api<{ recoveryCodes: string[] }>("/api/auth/mfa/enroll/confirm", {
      method: "POST",
      body: { code },
    });
    setBusy(false);

    if (!result.ok) {
      setError(errorMessage(result.error, "Código inválido. Use o código atual do aplicativo."));
      return;
    }
    setRecoveryCodes(result.data.recoveryCodes);
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("/api/auth/mfa/verify", { method: "POST", body: { code } });

    if (!result.ok) {
      setBusy(false);
      setError(errorMessage(result.error, "Código inválido ou já utilizado."));
      return;
    }
    continueToBuilder();
  };

  if (recoveryCodes) {
    return (
      <AuthCard
        title="Guarde seus códigos de recuperação"
        subtitle="Se perder o acesso ao aplicativo, cada código funciona uma única vez. Eles não serão exibidos de novo."
      >
        <ul data-testid="recovery-codes" className="grid grid-cols-2 gap-2 font-mono text-sm">
          {recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode} className="rounded-md bg-slate-100 px-3 py-2 text-center dark:bg-slate-800">
              {recoveryCode}
            </li>
          ))}
        </ul>
        <Button className="mt-6 w-full" onClick={continueToBuilder}>
          Guardei meus códigos, continuar
        </Button>
      </AuthCard>
    );
  }

  if (mode === "verify") {
    return (
      <AuthCard
        title="Verificação em duas etapas"
        subtitle="Digite o código do aplicativo autenticador ou um código de recuperação."
      >
        <form onSubmit={verify} className="space-y-4" noValidate>
          <Field
            id="code"
            label="Código do aplicativo ou de recuperação"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Verificar
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Proteja sua conta"
      subtitle="Proprietários e administradores entram com verificação em duas etapas, usando um aplicativo autenticador."
    >
      {secret ? (
        <form onSubmit={confirm} className="space-y-4" noValidate>
          <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Chave para o aplicativo</p>
            <p data-testid="mfa-secret" className="mt-1 break-all font-mono text-lg tracking-wider">
              {secret.match(/.{1,4}/g)?.join(" ")}
            </p>
            {keyUri ? (
              <a href={keyUri} className={`mt-2 inline-block text-sm ${LINK_CLASS}`}>
                Abrir no aplicativo autenticador
              </a>
            ) : null}
          </div>
          <Field
            id="code"
            label="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Confirmar
          </Button>
        </form>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
            <li>Instale um aplicativo autenticador, como Google Authenticator ou Microsoft Authenticator.</li>
            <li>Gere a chave e adicione-a ao aplicativo.</li>
            <li>Confirme com o código de 6 dígitos que aparecer.</li>
          </ol>
          {error ? (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <Button className="mt-6 w-full" loading={busy} onClick={startEnrollment}>
            Gerar chave do aplicativo
          </Button>
        </>
      )}
    </AuthCard>
  );
}
