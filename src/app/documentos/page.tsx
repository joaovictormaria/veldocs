import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EXPIRATION_STATUSES, EXPIRATIONS_MODULE_KEY } from "@/domain/documents/expiration";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { readSessionToken } from "@/infrastructure/http/session-cookie";
import { AppShell } from "@/presentation/components/app-shell";
import { DocumentsClient, type DocumentsData } from "@/presentation/screens/documents-client";
import { currentSession, nextStepFor } from "../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documentos — VELDOCS" };

const EMPTY_LISTING = { items: [], total: 0, page: 1, pageSize: 20 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A lista, as categorias e as listas de apoio são carregadas aqui, no servidor,
 * com a mesma autorização das rotas da API. Cada lista de apoio depende da
 * permissão correspondente, lida do próprio contexto autorizado.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const param = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };

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
  // Situação de vencimento é capacidade de módulo pago (MASTER SPEC 10.2).
  const expirations = (await services.entitlements.checkModule(context.companyId, EXPIRATIONS_MODULE_KEY)) === "enabled";

  // Links do painel abrem a lista já filtrada. Valor inválido é ignorado, e
  // situação só vale com o módulo.
  const initialFilters = {
    status: expirations && (EXPIRATION_STATUSES as readonly string[]).includes(param("status")) ? param("status") : "",
    categoryId: UUID.test(param("categoryId")) ? param("categoryId") : "",
  };

  const [listing, categories, branches, departments, members, tags] = await Promise.all([
    services.documents.list(context, initialFilters, { expirations }),
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
      expirations,
      initialFilters,
    }),
  ) as DocumentsData;

  return (
    <AppShell {...shell} hasExpirations={expirations}>
      <DocumentsClient data={data} />
    </AppShell>
  );
}
