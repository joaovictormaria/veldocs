import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { errorResponse, noContentResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const invitationIdSchema = z.uuid();

/** Revoga um convite pendente da empresa ativa. Convite de outra empresa: 404. */
export async function DELETE(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  const prepared = await prepareWrite(request, "members.invite", { body: false });
  if (!prepared.ok) return prepared.response;

  const invitationId = invitationIdSchema.safeParse((await params).invitationId);
  if (!invitationId.success) return errorResponse(404, "not_found");

  const { context, request: requestInfo } = prepared.prepared;
  const result = await getAuthServices().members.revokeInvitation(context, invitationId.data, requestInfo);
  return result.ok ? noContentResponse() : memberFailureResponse(result);
}
