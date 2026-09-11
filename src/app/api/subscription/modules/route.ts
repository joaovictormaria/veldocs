import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

/**
 * Troca kit e módulos durante o teste grátis vigente (MASTER SPEC 2.8): o valor
 * após o trial passa a refletir a nova escolha, sem mudar as datas do trial.
 * Body igual ao do início do trial: `{ "kitKey": "gestao", "modules": ["contratos"] }`.
 */
export async function PUT(request: Request) {
  const prepared = await prepareWrite(request, "billing.manage");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().subscriptions.changeModules(context, body, requestInfo);

  if (result.ok) return jsonResponse({ subscription: result.subscription });

  switch (result.reason) {
    case "invalid_input":
      return errorResponse(400, "invalid_input", { issues: result.issues });
    case "trial_not_started":
      return errorResponse(409, "trial_not_started", { message: "Escolha os módulos e inicie o teste grátis primeiro." });
    case "not_in_trial":
      return errorResponse(409, "not_in_trial", {
        message: "A troca de módulos pelo Builder só vale durante o teste grátis.",
      });
  }
}
