import type { NextResponse } from "next/server";
import type { FileResult } from "@/application/documents/manage-document-files";
import { errorResponse, jsonResponse } from "./responses";

/** Traduz a recusa de uma operação de arquivo para HTTP. */
export function fileFailureResponse(result: Extract<FileResult<unknown>, { ok: false }>): NextResponse {
  switch (result.reason) {
    case "invalid_input":
      return errorResponse(400, "invalid_input", { issues: result.issues });
    case "not_found":
      return errorResponse(404, "not_found", { message: "Arquivo ou documento não encontrado." });
    case "storage_unavailable":
      return errorResponse(503, "storage_unavailable", {
        message: "O armazenamento de arquivos não está disponível no momento.",
      });
  }
}

export function fileResponse<T>(result: FileResult<T>, body: (data: T) => unknown, status = 200): NextResponse {
  return result.ok ? jsonResponse(body(result.data), status) : fileFailureResponse(result);
}
