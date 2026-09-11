-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "kit_key" VARCHAR(60);

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_kit_key_fkey" FOREIGN KEY ("kit_key") REFERENCES "kits"("key") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Permissões de assinatura (Builder). Empresas novas as recebem pelo catálogo
-- de perfis no cadastro; aqui elas são criadas e concedidas aos perfis de
-- sistema OWNER e ADMIN das empresas que já existem.
-- -----------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "description") VALUES
  ('01a08eff-1e12-7438-b6c6-1de5d82c6f8e', 'billing.read', 'Ver módulos, kits, preços e a assinatura da empresa'),
  ('01a08eff-1e13-791e-9444-5ac47f3d2bec', 'billing.manage', 'Escolher módulos e kits e iniciar o trial')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('billing.read', 'billing.manage')
WHERE r."is_system" = true AND r."key" IN ('OWNER', 'ADMIN')
ON CONFLICT DO NOTHING;
