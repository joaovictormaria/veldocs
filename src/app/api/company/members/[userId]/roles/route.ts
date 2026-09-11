import { z } from "zod";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { memberFailureResponse } from "@/infrastructure/http/member-responses";
import { errorResponse, jsonResponse } from "@/infrastructure/http/responses";
import { prepareWrite } from "@/infrastructure/http/write-route";

const userIdSchema = z.uuid();

/** Substitui os perfis de um membro da empresa ativa. */
export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const prepared = await prepareWrite(request, "members.manage");
  if (!prepared.ok) return prepared.response;

  const userId = userIdSchema.safeParse((await params).userId);
  if (!userId.success) return errorResponse(404, "not_found");

  const services = getAuthServices();
  const { context, body, request: requestInfo } = prepared.prepared;
  const result = await services.members.changeRoles(context, userId.data, body, requestInfo);
  if (!result.ok) return memberFailureResponse(result);

  return jsonResponse({ member: await services.company.findMember(context, userId.data) });
}
