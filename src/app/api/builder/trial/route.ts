import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

/** Conclui o Builder: grava a escolha e inicia o trial de 14 dias (MASTER SPEC 2.4 e 2.8). */
export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "billing.manage");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().subscriptions.startTrial(context, body, requestInfo);

  if (result.ok) return jsonResponse({ subscription: result.subscription }, 201);
  if (result.reason === "trial_already_started") {
    return errorResponse(409, "trial_already_started", { message: "O trial desta empresa já foi iniciado." });
  }
  return errorResponse(400, "invalid_input", { issues: result.issues });
}
