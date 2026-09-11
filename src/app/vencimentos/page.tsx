import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import {
  type ExpirationsBlock,
  type ExpirationsData,
  ExpirationsClient,
} from "@/presentation/screens/expirations-client";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vencimentos — VELDOCS" };

/**
 * Capacidade do módulo Controle de vencimentos: `expirations.read` só passa
 * com o módulo contratado. Sem ele, a tela explica o que o módulo faz em vez
 * de simplesmente negar (MASTER SPEC 2.10).
 */
export default async function ExpirationsPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/vencimentos");
  if (nextStepFor(session) !== "/builder") redirect("/seguranca");

  const company = session.memberships.find((membership) => membership.companyId === session.session.activeCompanyId);
  const shell = {
    userName: session.user.name,
    companyName: company?.companyName ?? "Sua empresa",
    current: "/vencimentos",
  } as const;

  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "expirations.read");
  if (!authorization.ok) {
    if (authorization.reason === "unauthenticated") redirect("/entrar?next=/vencimentos");
    if (authorization.reason === "mfa_required" || authorization.reason === "mfa_enrollment_required") {
      redirect("/seguranca");
    }

    const block: ExpirationsBlock =
      authorization.reason === "module_not_enabled" || authorization.reason === "subscription_inactive"
        ? "module_not_enabled"
        : "forbidden";
    return (
      <AppShell {...shell}>
        <ExpirationsClient data={null} block={block} />
      </AppShell>
    );
  }

  const { context } = authorization;
  const summary = await services.expirations.summary(context, {});

  const data = summary.ok
    ? (JSON.parse(
        JSON.stringify({ ...summary.data, can: { renew: context.permissions.includes("expirations.manage") } }),
      ) as ExpirationsData)
    : null;

  return (
    <AppShell {...shell} hasExpirations>
      <ExpirationsClient data={data} />
    </AppShell>
  );
}
