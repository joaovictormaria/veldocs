import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { getEnv } from "@/infrastructure/config/env";
import { authorizeRequest } from "@/infrastructure/http/authorization";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { enforceRequestRateLimit } from "@/infrastructure/http/request-rate-limit";
import { jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

/** Convites pendentes da empresa ativa. */
export async function GET(request: Request) {
  const services = getAuthServices();

  const limited = await enforceRequestRateLimit(request, services.rateLimiter);
  if (limited) return limited;

  const authorization = await authorizeRequest("members.read", request);
  if (!authorization.ok) return authorization.response;

  return jsonResponse({ invitations: await services.members.listInvitations(authorization.context) });
}

/**
 * Cria um convite e devolve o link, exibido uma única vez: o token não fica
 * gravado. Sem e-mail transacional por enquanto, quem convida compartilha o link.
 */
export async function POST(request: Request) {
  const prepared = await prepareWrite(request, "members.invite");
  if (!prepared.ok) return prepared.response;

  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().members.invite(context, body, requestInfo);
  if (!result.ok) return memberFailureResponse(result);

  const inviteUrl = new URL(`/convite/${result.token}`, getEnv().APP_URL).toString();
  return jsonResponse({ invitation: result.invitation, inviteUrl }, 201);
}
