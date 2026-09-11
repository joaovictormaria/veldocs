-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "search_text" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "normalized_name" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tags" (
    "company_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("company_id","document_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_company_id_id_key" ON "tags"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_company_id_normalized_name_key" ON "tags"("company_id", "normalized_name");

-- CreateIndex
CREATE INDEX "document_tags_company_id_tag_id_idx" ON "document_tags"("company_id", "tag_id");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_company_id_document_id_fkey" FOREIGN KEY ("company_id", "document_id") REFERENCES "documents"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_company_id_tag_id_fkey" FOREIGN KEY ("company_id", "tag_id") REFERENCES "tags"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Integridade documental (regras que o schema do Prisma não expressa).
-- -----------------------------------------------------------------------------
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_title_not_blank_chk" CHECK (length(btrim("title")) > 0),
  -- Validade nunca antes da emissão. Documento sem uma das datas passa.
  ADD CONSTRAINT "documents_dates_order_chk"
    CHECK ("issue_date" IS NULL OR "expiration_date" IS NULL OR "expiration_date" >= "issue_date");

ALTER TABLE "document_categories"
  ADD CONSTRAINT "document_categories_name_not_blank_chk" CHECK (length(btrim("name")) > 0),
  -- Ciclo de um nó só; ciclos maiores são impedidos pela aplicação em transação.
  ADD CONSTRAINT "document_categories_not_own_parent_chk" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "tags"
  ADD CONSTRAINT "tags_name_not_blank_chk" CHECK (length(btrim("name")) > 0),
  -- O nome normalizado é minúsculo e sem espaços nas pontas (busca sem acento).
  ADD CONSTRAINT "tags_normalized_name_format_chk"
    CHECK ("normalized_name" = lower("normalized_name") AND "normalized_name" = btrim("normalized_name"));
