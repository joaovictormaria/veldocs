import type { NextResponse } from "next/server";
import type { ValidationIssue } from "@/application/access/manage-company";
import { errorResponse } from "./responses";

const FAILURES: Readonly<Record<string, { readonly status: number; readonly message: string }>> = {
  unauthenticated: { status: 401, message: "Faça login para continuar." },
  not_found: { status: 404, message: "Registro não encontrado." },
  cannot_modify_self: { status: 403, message: "Você não pode alterar o próprio acesso." },
  role_not_allowed: {
    status: 403,
    message: "Só um Proprietário pode conceder, alterar ou remover o perfil Proprietário.",
  },
  last_owner: { status: 409, message: "A empresa precisa manter pelo menos um Proprietário ativo." },
  already_member: { status: 409, message: "Esta pessoa já faz parte da empresa." },
  invitation_not_available: {
    status: 404,
    message: "Este convite não é válido: pode ter expirado, sido revogado ou já usado.",
  },
  email_mismatch: { status: 403, message: "Este convite foi enviado para outro e-mail." },
  account_exists: { status: 409, message: "Já existe uma conta com este e-mail. Entre e aceite o convite." },
};

/** Recusas de membros e convites em HTTP, com código estável e mensagem para a tela. */
export function memberFailureResponse(result: {
  readonly reason: string;
  readonly issues?: readonly ValidationIssue[];
}): NextResponse {
  if (result.reason === "invalid_input") return errorResponse(400, "invalid_input", { issues: result.issues ?? [] });
  const failure = FAILURES[result.reason] ?? { status: 400, message: "Não foi possível concluir a operação." };
  return errorResponse(failure.status, result.reason, { message: failure.message });
}
