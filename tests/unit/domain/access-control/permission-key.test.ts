import { describe, expect, it } from "vitest";
import {
  PERMISSION_KEY_MAX_LENGTH,
  parsePermissionKey,
  permissionKeySchema,
} from "@/domain/access-control/permission-key";

describe("permissionKeySchema", () => {
  it.each(["documents.read", "documents.create", "audit_logs.read", "company.branches.update"])(
    "aceita %s",
    (key) => {
      expect(permissionKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it.each([
    "documents",
    "Documents.read",
    "documents.",
    ".read",
    "documents read",
    "documents.read;drop",
    "documents..read",
    "1documents.read",
    "",
  ])("rejeita %j", (key) => {
    expect(permissionKeySchema.safeParse(key).success).toBe(false);
  });

  it("rejeita chaves acima do tamanho máximo", () => {
    const key = `${"a".repeat(PERMISSION_KEY_MAX_LENGTH)}.read`;
    expect(permissionKeySchema.safeParse(key).success).toBe(false);
  });
});

describe("parsePermissionKey", () => {
  it("separa recurso e ação", () => {
    expect(parsePermissionKey("documents.read")).toEqual({ resource: "documents", action: "read" });
  });

  it("considera a ação como o último segmento em recursos aninhados", () => {
    expect(parsePermissionKey("company.branches.update")).toEqual({
      resource: "company.branches",
      action: "update",
    });
  });

  it("lança erro para chave inválida", () => {
    expect(() => parsePermissionKey("documents")).toThrow();
  });
});
