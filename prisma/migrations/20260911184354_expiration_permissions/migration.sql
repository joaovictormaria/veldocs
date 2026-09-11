-- -----------------------------------------------------------------------------
-- Permissões do módulo Controle de vencimentos (MASTER SPEC 10.2).
-- Primeira capacidade de MÓDULO PAGO: o perfil dá a permissão, o entitlement
-- dá o módulo, e a autorização exige os dois (DEC-022). Empresas novas as
-- recebem pelo catálogo de perfis no cadastro; aqui elas são criadas e
-- concedidas aos perfis de sistema das empresas que já existem.
-- -----------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "description") VALUES
  ('01a091c8-8b34-750a-8ac2-55385667c0b6', 'expirations.read', 'Ver a situação de vencimento dos documentos'),
  ('01a091c8-8b35-7310-8249-a663db580475', 'expirations.manage', 'Renovar documentos e atualizar prazos')
ON CONFLICT ("key") DO NOTHING;

-- Leitura para todos os perfis padrão.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'expirations.read'
WHERE r."is_system" = true AND r."key" IN ('OWNER', 'ADMIN', 'GESTOR', 'COLABORADOR', 'VISUALIZADOR')
ON CONFLICT DO NOTHING;

-- Renovação só para quem já edita documentos.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'expirations.manage'
WHERE r."is_system" = true AND r."key" IN ('OWNER', 'ADMIN', 'GESTOR', 'COLABORADOR')
ON CONFLICT DO NOTHING;
