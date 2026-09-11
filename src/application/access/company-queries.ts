import type { CompanyDirectory } from "@/application/ports/access-control";
import type { AuthorizedContext } from "./authorize";

/**
 * Consultas da empresa ativa. Recebem apenas um `AuthorizedContext` (produzido
 * pelo autorizador) e nunca aceitam a empresa como parâmetro externo — o
 * filtro por tenant é obrigatório por construção.
 */
export function createCompanyQueries(directory: CompanyDirectory) {
  return {
    currentCompany: (context: AuthorizedContext) => directory.findCompany(context.companyId),
    listMembers: (context: AuthorizedContext) => directory.listMembers(context.companyId),
    findMember: (context: AuthorizedContext, userId: string) => directory.findMember(context.companyId, userId),
  };
}

export type CompanyQueries = ReturnType<typeof createCompanyQueries>;
