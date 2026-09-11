import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MAX_CATEGORY_DEPTH } from "@/domain/documents/category-tree";
import { EXPIRATIONS_MODULE_KEY } from "@/domain/documents/expiration";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import { CategoriesClient, type CategoriesData } from "@/presentation/screens/categories-client";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categorias — VELDOCS" };

export default async function CategoriesPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/categorias");
  if (nextStepFor(session) !== "/builder") redirect("/seguranca");

  const company = session.memberships.find((membership) => membership.companyId === session.session.activeCompanyId);
  const shell = {
    userName: session.user.name,
    companyName: company?.companyName ?? "Sua empresa",
    current: "/categorias",
  } as const;

  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "categories.read");
  if (!authorization.ok) {
    if (authorization.reason === "unauthenticated") redirect("/entrar?next=/categorias");
    if (authorization.reason === "mfa_required" || authorization.reason === "mfa_enrollment_required") {
      redirect("/seguranca");
    }
    return (
      <AppShell {...shell}>
        <CategoriesClient data={null} />
      </AppShell>
    );
  }

  const { context } = authorization;
  const [categories, entitlement] = await Promise.all([
    services.categories.list(context),
    services.entitlements.checkModule(context.companyId, EXPIRATIONS_MODULE_KEY),
  ]);

  const data = JSON.parse(
    JSON.stringify({
      categories,
      maxDepth: MAX_CATEGORY_DEPTH,
      can: { manage: context.permissions.includes("categories.manage") },
    }),
  ) as CategoriesData;

  return (
    <AppShell {...shell} hasExpirations={entitlement === "enabled"}>
      <CategoriesClient data={data} />
    </AppShell>
  );
}
