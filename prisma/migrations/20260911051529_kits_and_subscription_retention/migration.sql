-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "kits" (
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "audience" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "kit_modules" (
    "kit_key" VARCHAR(60) NOT NULL,
    "module_key" VARCHAR(60) NOT NULL,

    CONSTRAINT "kit_modules_pkey" PRIMARY KEY ("kit_key","module_key")
);

-- CreateTable
CREATE TABLE "kit_prices" (
    "id" UUID NOT NULL,
    "kit_key" VARCHAR(60) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "billing_period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kit_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kit_modules_module_key_idx" ON "kit_modules"("module_key");

-- CreateIndex
CREATE INDEX "kit_prices_kit_key_valid_from_idx" ON "kit_prices"("kit_key", "valid_from");

-- AddForeignKey
ALTER TABLE "kit_modules" ADD CONSTRAINT "kit_modules_kit_key_fkey" FOREIGN KEY ("kit_key") REFERENCES "kits"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_modules" ADD CONSTRAINT "kit_modules_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_prices" ADD CONSTRAINT "kit_prices_kit_key_fkey" FOREIGN KEY ("kit_key") REFERENCES "kits"("key") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Integridade dos preços de kit (mesmas regras dos preços de módulo).
-- -----------------------------------------------------------------------------
ALTER TABLE "kit_prices"
  ADD CONSTRAINT "kit_prices_amount_non_negative_chk" CHECK ("amount_cents" >= 0),
  ADD CONSTRAINT "kit_prices_validity_order_chk" CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from"),
  ADD CONSTRAINT "kit_prices_currency_format_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

-- -----------------------------------------------------------------------------
-- Kits definidos pelo usuário em 2026-09-11 (MASTER SPEC 2.7, DEC-024).
-- Espelha src/domain/billing/kit-catalog.ts; a divergência é checada por teste.
-- O Essencial foi mantido pelo usuário em R$ 69,90, R$ 0,10 acima dos mesmos
-- módulos avulsos — por isso o Builder nunca o sugere.
-- -----------------------------------------------------------------------------
INSERT INTO "kits" ("key", "name", "audience", "sort_order", "updated_at") VALUES
  ('essencial', 'Essencial', 'Empresas que querem começar', 0, CURRENT_TIMESTAMP),
  ('gestao', 'Gestão', 'Empresas que controlam pessoas e fornecedores', 10, CURRENT_TIMESTAMP),
  ('inteligencia', 'Inteligência', 'Empresas que querem IA e análise', 20, CURRENT_TIMESTAMP),
  ('comunicacao', 'Comunicação', 'Empresas que precisam interagir com terceiros', 30, CURRENT_TIMESTAMP),
  ('controle-avancado', 'Controle Avançado', 'Empresas com processos mais estruturados', 40, CURRENT_TIMESTAMP),
  ('complete', 'Complete', 'Empresas que querem praticamente tudo', 50, CURRENT_TIMESTAMP);

INSERT INTO "kit_modules" ("kit_key", "module_key") VALUES
  ('essencial', 'core'),
  ('essencial', 'vencimentos'),
  ('gestao', 'core'),
  ('gestao', 'vencimentos'),
  ('gestao', 'funcionarios'),
  ('gestao', 'fornecedores'),
  ('gestao', 'solicitacoes'),
  ('inteligencia', 'core'),
  ('inteligencia', 'analise-documentos'),
  ('inteligencia', 'assistente-ia'),
  ('inteligencia', 'ocr'),
  ('inteligencia', 'score-documental'),
  ('inteligencia', 'radar-risco'),
  ('comunicacao', 'core'),
  ('comunicacao', 'solicitacoes'),
  ('comunicacao', 'whatsapp'),
  ('comunicacao', 'portal-terceiros'),
  ('controle-avancado', 'core'),
  ('controle-avancado', 'contratos'),
  ('controle-avancado', 'aprovacoes'),
  ('controle-avancado', 'automacao'),
  ('controle-avancado', 'relatorios-avancados'),
  ('controle-avancado', 'modo-auditoria'),
  ('complete', 'core'),
  ('complete', 'vencimentos'),
  ('complete', 'funcionarios'),
  ('complete', 'fornecedores'),
  ('complete', 'contratos'),
  ('complete', 'solicitacoes'),
  ('complete', 'aprovacoes'),
  ('complete', 'automacao'),
  ('complete', 'analise-documentos'),
  ('complete', 'assistente-ia'),
  ('complete', 'whatsapp'),
  ('complete', 'portal-terceiros'),
  ('complete', 'relatorios-avancados'),
  ('complete', 'ocr'),
  ('complete', 'score-documental'),
  ('complete', 'radar-risco'),
  ('complete', 'modo-auditoria');

INSERT INTO "kit_prices" ("id", "kit_key", "amount_cents", "currency", "billing_period", "valid_from") VALUES
  ('01a08e68-5f80-7908-9dfe-7505165f511b', 'essencial', 6990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f81-7864-a0c9-7681e64fb5a5', 'gestao', 12990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f82-7bc4-a042-6f3cc45a6048', 'inteligencia', 19990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f83-79a5-8fd9-c05f5bf8bba4', 'comunicacao', 11990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f84-778d-b275-8e94cf9072e2', 'controle-avancado', 16990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z'),
  ('01a08e68-5f85-79b0-bc4c-a3b70cfac178', 'complete', 39990, 'BRL', 'MONTHLY', '2026-09-11T03:00:00.000Z');
