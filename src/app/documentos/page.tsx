import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import { DocumentsClient, type DocumentsData } from "@/presentation/screens/documents-client";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documentos — VELDOCS" };

const EMPTY_LISTING = { items: [], total: 0, page: 1, pageSize: 20 } as const;

/**
 * A lista, as categorias e as listas de apoio são carregadas aqui, no servidor,
 * com a mesma autorização das rotas da API. Cada lista de apoio depende da
 * permissão correspondente, lida do próprio contexto autorizado.
 */
export default async function DocumentsPage() {
  const session = await currentSession();
  if (!session) redirect("/entrar?next=/documentos");
  if (nextStepFor(session) !== "/builder") redirect("/seguranca");

  const company = session.memberships.find((membership) => membership.companyId === session.session.activeCompanyId);
  const shell = {
    userName: session.user.name,
    companyName: company?.companyName ?? "Sua empresa",
    current: "/documentos",
  } as const;

  const services = getAuthServices();
  const authorization = await services.authorize(await readSessionToken(getEnv().APP_URL), "documents.read");
  if (!authorization.ok) {
    if (authorization.reason === "unauthenticated") redirect("/entrar?next=/documentos");
    if (authorization.reason === "mfa_required" || authorization.reason === "mfa_enrollment_required") {
      redirect("/seguranca");
    }
    return (
      <AppShell {...shell}>
        <DocumentsClient data={null} />
      </AppShell>
    );
  }

  const { context } = authorization;
  const can = (permission: string) => context.permissions.includes(permission);

  const [listing, categories, branches, departments, members, tags] = await Promise.all([
    services.documents.list(context, {}),
    can("categories.read") ? services.categories.list(context) : [],
    can("branches.read") ? services.companyManagement.listBranches(context) : [],
    can("departments.read") ? services.companyManagement.listDepartments(context) : [],
    can("members.read") ? services.company.listMembers(context) : [],
    services.documents.listTags(context),
  ]);

  // Props de Client Component precisam ser serializáveis: as datas viram texto ISO.
  const data = JSON.parse(
    JSON.stringify({
      listing: listing.ok ? listing.data : EMPTY_LISTING,
      categories: categories.map((category) => ({ id: category.id, name: category.name, path: category.path })),
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        branchId: department.branchId,
      })),
      members: members
        .filter((member) => member.status === "ACTIVE")
        .map((member) => ({ userId: member.userId, name: member.name })),
      tags,
      can: {
        create: can("documents.create"),
        update: can("documents.update"),
        remove: can("documents.delete"),
      },
    }),
  ) as DocumentsData;

  return (
    <AppShell {...shell}>
      <DocumentsClient data={data} />
    </AppShell>
  );
}
