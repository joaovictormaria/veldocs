import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TRIAL_DAYS } from "@/domain/billing/subscription-status";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import { BuilderClient, type BuilderData } from "@/presentation/screens/builder-client";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Builder — VELDOCS" };

/**
 * Catálogo, kits e assinatura são carregados aqui, no servidor, com a mesma
 * autorização das rotas da API (`billing.read`).
 */
export default async function BuilderPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/builder");
  if (nextStepFor(session) !== "/builder") redirect("/seguranca");

  const company = session.memberships.find((membership) => membership.companyId === session.session.activeCompanyId);
  const shell = {
    userName: session.user.name,
    companyName: company?.companyName ?? "Sua empresa",
    current: "/builder",
  } as const;

  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "billing.read");
  if (!authorization.ok) {
    if (authorization.reason === "unauthenticated") redirect("/entrar?next=/builder");
    if (authorization.reason === "mfa_required" || authorization.reason === "mfa_enrollment_required") {
      redirect("/seguranca");
    }
    // Perfil sem permissão de assinatura ou sem empresa ativa.
    return (
      <AppShell {...shell}>
        <BuilderClient data={null} />
      </AppShell>
    );
  }

  const [modules, kits, subscription] = await Promise.all([
    services.catalog.listCatalog(),
    services.catalog.listKits(),
    services.subscriptions.getSummary(authorization.context),
  ]);

  // Props de Client Component precisam ser serializáveis: as datas viram texto ISO.
  const data = JSON.parse(
    JSON.stringify({ catalog: { modules, kits, trialDays: TRIAL_DAYS }, subscription }),
  ) as BuilderData;

  return (
    <AppShell {...shell}>
      <BuilderClient data={data} />
    </AppShell>
  );
}
