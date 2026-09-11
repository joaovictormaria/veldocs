import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EXPIRATIONS_MODULE_KEY } from "@/domain/documents/expiration";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import { Alert, LINK_CLASS } from "@/presentation/components/ui";
import { type DashboardData, DashboardView } from "@/presentation/screens/dashboard-view";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Painel — VELDOCS" };

/** Painel da empresa: carregado no servidor com a mesma autorização da API. */
export default async function DashboardPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/painel");
  if (nextStepFor(session) !== "/builder") redirect("/seguranca");

  const company = session.memberships.find((membership) => membership.companyId === session.session.activeCompanyId);
  const companyName = company?.companyName ?? "Sua empresa";
  const shell = { userName: session.user.name, companyName, current: "/painel" } as const;

  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "documents.read");
  if (!authorization.ok) {
    if (authorization.reason === "unauthenticated") redirect("/entrar?next=/painel");
    if (authorization.reason === "mfa_required" || authorization.reason === "mfa_enrollment_required") {
      redirect("/seguranca");
    }

    return (
      <AppShell {...shell}>
        {authorization.reason === "subscription_inactive" ? (
          <Alert>
            A assinatura da empresa não está ativa. Seus dados continuam guardados.{" "}
            <Link href="/builder" className={LINK_CLASS}>
              Ver a assinatura
            </Link>
          </Alert>
        ) : (
          <Alert tone="info">Seu perfil não tem permissão para ver o painel desta empresa.</Alert>
        )}
      </AppShell>
    );
  }

  const { context } = authorization;
  const expirations = (await services.entitlements.checkModule(context.companyId, EXPIRATIONS_MODULE_KEY)) === "enabled";
  const summary = await services.dashboard.summary(context, { expirations });

  const data = JSON.parse(
    JSON.stringify({ ...summary, userName: session.user.name, companyName, now: new Date() }),
  ) as DashboardData;

  return (
    <AppShell {...shell} hasExpirations={expirations}>
      <DashboardView data={data} />
    </AppShell>
  );
}
