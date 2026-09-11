import type { AuthorizationFailure } from "@/application/access/authorize";
import { errorResponse } from "./responses";

const RESPONSES: Record<AuthorizationFailure, { status: number; error: string; message: string }> = {
  unauthenticated: { status: 401, error: "unauthenticated", message: "Faça login para continuar." },
  active_company_required: {
    status: 403,
    error: "active_company_required",
    message: "Selecione uma empresa para continuar.",
  },
  forbidden: { status: 403, error: "forbidden", message: "Você não tem permissão para esta ação." },
  module_not_enabled: {
    status: 403,
    error: "module_not_enabled",
    message: "Este recurso não está ativo no plano da empresa.",
  },
  subscription_inactive: {
    status: 403,
    error: "subscription_inactive",
    message: "A assinatura da empresa não está ativa. Seus dados estão guardados: assine para voltar a usar.",
  },
  mfa_enrollment_required: {
    status: 403,
    error: "mfa_enrollment_required",
    message: "Seu perfil exige verificação em duas etapas. Configure o app autenticador.",
  },
  mfa_required: {
    status: 403,
    error: "mfa_required",
    message: "Confirme o código do app autenticador para continuar.",
  },
};

export function authorizationFailureResponse(reason: AuthorizationFailure) {
  const { status, error, message } = RESPONSES[reason];
  return errorResponse(status, error, { message });
}

export function authorizationFailureStatus(reason: AuthorizationFailure): number {
  return RESPONSES[reason].status;
}
