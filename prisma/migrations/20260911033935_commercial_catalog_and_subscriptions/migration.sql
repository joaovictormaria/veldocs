-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('AVAILABLE', 'COMING_SOON', 'RETIRED');

-- CreateEnum
CREATE TYPE "CompanyModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAYMENT_PENDING', 'PAST_DUE', 'CANCELED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "modules" (
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "benefit" VARCHAR(255) NOT NULL,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModuleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "module_dependencies" (
    "module_key" VARCHAR(60) NOT NULL,
    "depends_on_key" VARCHAR(60) NOT NULL,

    CONSTRAINT "module_dependencies_pkey" PRIMARY KEY ("module_key","depends_on_key")
);

-- CreateTable
CREATE TABLE "module_prices" (
    "id" UUID NOT NULL,
    "module_key" VARCHAR(60) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "billing_period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_modules" (
    "company_id" UUID NOT NULL,
    "module_key" VARCHAR(60) NOT NULL,
    "status" "CompanyModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("company_id","module_key")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trial_started_at" TIMESTAMPTZ(3),
    "trial_ends_at" TIMESTAMPTZ(3),
    "current_period_end" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "reactivated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_dependencies_depends_on_key_idx" ON "module_dependencies"("depends_on_key");

-- CreateIndex
CREATE INDEX "module_prices_module_key_valid_from_idx" ON "module_prices"("module_key", "valid_from");

-- CreateIndex
CREATE INDEX "company_modules_company_id_status_idx" ON "company_modules"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_company_id_key" ON "subscriptions"("company_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_trial_ends_at_idx" ON "subscriptions"("trial_ends_at");

-- AddForeignKey
ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_depends_on_key_fkey" FOREIGN KEY ("depends_on_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_prices" ADD CONSTRAINT "module_prices_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Catálogo inicial de módulos (MASTER SPEC 2.2 e 2.3).
-- Espelha src/domain/billing/module-catalog.ts; a divergência entre os dois é
-- checada por teste de integração.
-- Preços não entram aqui: serão definidos comercialmente (MASTER SPEC 2.3).
-- -----------------------------------------------------------------------------
INSERT INTO "modules" ("key", "name", "description", "benefit", "is_core", "status", "sort_order", "updated_at") VALUES
  ('core', 'Core', 'Empresa, usuários, autenticação, permissões, gestão documental, storage e dashboard básico.', 'A base do VELDOCS: sem ela o produto não existe.', true, 'AVAILABLE', 0, CURRENT_TIMESTAMP),
  ('vencimentos', 'Controle de vencimentos', 'Acompanhamento de validade dos documentos, com alertas antes do vencimento.', 'Nenhum documento vence sem aviso.', false, 'AVAILABLE', 10, CURRENT_TIMESTAMP),
  ('funcionarios', 'Funcionários', 'Documentos vinculados a cada funcionário e ao seu cargo.', 'A documentação da equipe sempre em dia.', false, 'AVAILABLE', 20, CURRENT_TIMESTAMP),
  ('fornecedores', 'Fornecedores', 'Documentos e regularidade dos fornecedores.', 'Contrate sabendo quem está regular.', false, 'AVAILABLE', 30, CURRENT_TIMESTAMP),
  ('contratos', 'Contratos', 'Ciclo de vida dos contratos, prazos e renovações.', 'Nenhuma renovação esquecida.', false, 'AVAILABLE', 40, CURRENT_TIMESTAMP),
  ('solicitacoes', 'Solicitações', 'Pedidos de documentos para pessoas dentro e fora da empresa.', 'Peça e receba documentos sem perder o controle.', false, 'AVAILABLE', 50, CURRENT_TIMESTAMP),
  ('aprovacoes', 'Aprovações', 'Fluxos de aprovação com responsáveis e histórico.', 'Cada documento aprovado por quem tem autoridade.', false, 'AVAILABLE', 60, CURRENT_TIMESTAMP),
  ('automacao', 'Automação', 'Regras automáticas para alertas, cobranças e rotinas documentais.', 'O sistema cobra por você.', false, 'AVAILABLE', 70, CURRENT_TIMESTAMP),
  ('analise-documentos', 'Análise inteligente de documentos', 'Leitura automática do conteúdo dos documentos e extração de informações-chave.', 'O sistema entende o que está no documento.', false, 'AVAILABLE', 80, CURRENT_TIMESTAMP),
  ('assistente-ia', 'Assistente IA', 'Assistente que responde perguntas sobre a documentação da empresa.', 'Pergunte em vez de procurar.', false, 'AVAILABLE', 90, CURRENT_TIMESTAMP),
  ('whatsapp', 'WhatsApp', 'Consultas e avisos pelo WhatsApp.', 'A documentação no canal que a equipe já usa.', false, 'AVAILABLE', 100, CURRENT_TIMESTAMP),
  ('portal-terceiros', 'Portal de terceiros', 'Área externa para fornecedores e parceiros enviarem documentos.', 'Terceiros enviam documentos sem acessar o sistema interno.', false, 'AVAILABLE', 110, CURRENT_TIMESTAMP),
  ('relatorios-avancados', 'Relatórios avançados', 'Relatórios detalhados e exportações da situação documental.', 'Os números prontos para a diretoria.', false, 'AVAILABLE', 120, CURRENT_TIMESTAMP),
  ('ocr', 'OCR / extração de dados', 'Reconhecimento de texto em documentos digitalizados.', 'Documento escaneado vira informação pesquisável.', false, 'AVAILABLE', 130, CURRENT_TIMESTAMP),
  ('score-documental', 'Score documental', 'Indicador do nível de regularidade documental da empresa.', 'Uma nota que resume a saúde documental.', false, 'AVAILABLE', 140, CURRENT_TIMESTAMP),
  ('radar-risco', 'Radar de risco', 'Destaque para os pontos de risco documental mais urgentes.', 'Veja primeiro o que pode causar problema.', false, 'AVAILABLE', 150, CURRENT_TIMESTAMP),
  ('modo-auditoria', 'Modo auditoria', 'Visão e exportação preparadas para auditorias e fiscalizações.', 'Chegue na auditoria com tudo organizado.', false, 'AVAILABLE', 160, CURRENT_TIMESTAMP);

-- -----------------------------------------------------------------------------
-- Toda empresa já existente recebe o Core, que é obrigatório (MASTER SPEC 2.2).
-- -----------------------------------------------------------------------------
INSERT INTO "company_modules" ("company_id", "module_key", "status", "updated_at")
SELECT "id", 'core', 'ACTIVE', CURRENT_TIMESTAMP FROM "companies"
ON CONFLICT DO NOTHING;
