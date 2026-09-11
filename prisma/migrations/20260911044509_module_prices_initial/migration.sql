-- -----------------------------------------------------------------------------
-- Integridade dos preços (regras que o schema do Prisma não expressa).
-- -----------------------------------------------------------------------------
ALTER TABLE "module_prices"
  ADD CONSTRAINT "module_prices_amount_non_negative_chk" CHECK ("amount_cents" >= 0),
  ADD CONSTRAINT "module_prices_validity_order_chk" CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from"),
  ADD CONSTRAINT "module_prices_currency_format_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

-- -----------------------------------------------------------------------------
-- Preços iniciais dos módulos (decisão do usuário em 2026-09-11).
-- Mensais, em centavos, vigentes a partir de 11/09/2026 00:00 (Brasília).
-- Total com todos os 17 módulos: R$ 638,30 por mês.
-- Para mudar um preço: nova migração que encerra o atual (valid_until) e insere
-- o novo — o histórico nunca é sobrescrito.
-- -----------------------------------------------------------------------------
INSERT INTO "module_prices" ("id", "module_key", "amount_cents", "currency", "billing_period", "valid_from") VALUES
  ('01a08e68-5f80-750a-8279-935b7ef35cc7', 'core', 4990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f81-744c-91d2-a63fa9bc12c2', 'vencimentos', 1990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f82-7e2f-924c-3033a22780c7', 'funcionarios', 2990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f83-7d7d-97bf-33700f2b34ac', 'fornecedores', 2990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f84-7cf1-baf2-143809fccdae', 'contratos', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f85-79cb-bf85-5d6b4350b094', 'solicitacoes', 2990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f86-76ae-853b-05a4bfebd11f', 'aprovacoes', 1990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f87-709a-929d-98a74511990d', 'automacao', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f88-7e09-9c6b-c6ebebbcb883', 'analise-documentos', 5990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f89-7ed4-9442-27f6283e8a6f', 'assistente-ia', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8a-7754-a978-4e33e09f8f7e', 'whatsapp', 5990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8b-767d-aebc-6f5fe7ee1415', 'portal-terceiros', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8c-71f6-a47f-8014dc379a62', 'relatorios-avancados', 2990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8d-7731-ad31-78937ec49f06', 'ocr', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8e-767c-b7ed-5d05b9e67b91', 'score-documental', 2990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f8f-797b-b662-a627e29807b3', 'radar-risco', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f90-732c-b6f6-6982f961b423', 'modo-auditoria', 3990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z');
