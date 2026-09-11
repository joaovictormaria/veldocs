-- CreateEnum
CREATE TYPE "DocumentFileStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REJECTED');

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(160) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "DocumentFileStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" VARCHAR(200),
    "uploaded_by_id" UUID NOT NULL,
    "upload_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "available_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_files_object_key_key" ON "document_files"("object_key");

-- CreateIndex
CREATE INDEX "document_files_company_id_document_id_status_idx" ON "document_files"("company_id", "document_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_company_id_id_key" ON "document_files"("company_id", "id");

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_company_id_document_id_fkey" FOREIGN KEY ("company_id", "document_id") REFERENCES "documents"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_company_id_uploaded_by_id_fkey" FOREIGN KEY ("company_id", "uploaded_by_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Integridade dos arquivos (regras que o schema do Prisma não expressa).
-- -----------------------------------------------------------------------------
ALTER TABLE "document_files"
  -- A chave do objeto é feita dos ids da própria linha: um arquivo nunca aponta
  -- para o prefixo de outra empresa, nem por bug na aplicação.
  ADD CONSTRAINT "document_files_object_key_matches_ids_chk"
    CHECK ("object_key" = 'companies/' || "company_id" || '/documents/' || "document_id" || '/files/' || "id"),
  -- Mesmo limite da aplicação: 25 MB.
  ADD CONSTRAINT "document_files_size_chk" CHECK ("size_bytes" > 0 AND "size_bytes" <= 26214400),
  -- Mesma allowlist da aplicação (src/domain/documents/file-policy.ts).
  ADD CONSTRAINT "document_files_content_type_chk"
    CHECK ("content_type" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  ADD CONSTRAINT "document_files_file_name_not_blank_chk" CHECK (length(btrim("file_name")) > 0),
  -- Disponível sempre com data; data só quando disponível.
  ADD CONSTRAINT "document_files_available_at_chk" CHECK (("status" = 'AVAILABLE') = ("available_at" IS NOT NULL)),
  -- Recusado sempre com motivo; motivo só quando recusado.
  ADD CONSTRAINT "document_files_rejection_reason_chk"
    CHECK (("status" = 'REJECTED') = ("rejection_reason" IS NOT NULL));
