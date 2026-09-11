-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- Migração de dados (DEC-005): a pessoa deixa de pertencer a uma única empresa.
-- Cada pessoa existente ganha um vínculo com a empresa em que estava, com o
-- status equivalente. Só depois o status da pessoa e users.company_id mudam.
-- =============================================================================
INSERT INTO "memberships" ("id", "company_id", "user_id", "status", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "company_id",
    "id",
    (CASE "status"::text WHEN 'DISABLED' THEN 'SUSPENDED' ELSE "status"::text END)::"MembershipStatus",
    "created_at",
    CURRENT_TIMESTAMP
FROM "users";

-- O convite passa a ser do vínculo; a pessoa em si fica ativa.
UPDATE "users" SET "status" = 'ACTIVE' WHERE "status" = 'INVITED';

-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'DISABLED');
ALTER TABLE "public"."users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_company_id_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_company_id_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_company_id_responsible_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_company_id_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_company_id_fkey";

-- DropIndex
DROP INDEX "users_company_id_id_key";

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("company_id", "user_id", "role_id");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "company_id",
ADD COLUMN     "cpf_encrypted" VARCHAR(255),
ADD COLUMN     "cpf_lookup_hash" VARCHAR(64),
ADD COLUMN     "email_verified_at" TIMESTAMPTZ(3),
ADD COLUMN     "password_hash" VARCHAR(255),
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "sessions" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "active_company_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "mfa_verified_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_company_id_user_id_key" ON "memberships"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_company_id_id_key" ON "memberships"("company_id", "id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_active_company_id_user_id_idx" ON "sessions"("active_company_id", "user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_lookup_hash_key" ON "users"("cpf_lookup_hash");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_company_id_user_id_fkey" FOREIGN KEY ("company_id", "user_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_responsible_user_id_fkey" FOREIGN KEY ("company_id", "responsible_user_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_created_by_id_fkey" FOREIGN KEY ("company_id", "created_by_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_actor_user_id_fkey" FOREIGN KEY ("company_id", "actor_user_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_company_id_user_id_fkey" FOREIGN KEY ("active_company_id", "user_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- Regras adicionais (SQL manual — não representáveis no schema Prisma)
-- =============================================================================

-- CPF somente como HMAC (hex) e valor cifrado, sempre em par.
ALTER TABLE "users" ADD CONSTRAINT "users_cpf_lookup_hash_format_chk" CHECK ("cpf_lookup_hash" IS NULL OR "cpf_lookup_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "users" ADD CONSTRAINT "users_cpf_fields_paired_chk" CHECK (("cpf_lookup_hash" IS NULL) = ("cpf_encrypted" IS NULL));

-- Sessão: id é o SHA-256 (hex) do token; a expiração por inatividade nunca passa da absoluta.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_id_format_chk" CHECK ("id" ~ '^[0-9a-f]{64}$');
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_order_chk" CHECK ("expires_at" <= "absolute_expires_at");

-- Rate limiting: contador sempre positivo.
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_count_positive_chk" CHECK ("count" > 0);
