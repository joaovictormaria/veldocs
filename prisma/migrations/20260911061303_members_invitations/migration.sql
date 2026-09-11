-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'REMOVED';

-- CreateTable
CREATE TABLE "company_invitations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "accepted_by_user_id" UUID,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "company_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "company_invitations_company_id_email_idx" ON "company_invitations"("company_id", "email");

-- CreateIndex
CREATE INDEX "company_invitations_expires_at_idx" ON "company_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_role_id_fkey" FOREIGN KEY ("company_id", "role_id") REFERENCES "roles"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_invited_by_user_id_fkey" FOREIGN KEY ("company_id", "invited_by_user_id") REFERENCES "memberships"("company_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Integridade dos convites (regras que o schema do Prisma não expressa).
-- -----------------------------------------------------------------------------
ALTER TABLE "company_invitations"
  ADD CONSTRAINT "company_invitations_email_lowercase_chk" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "company_invitations_token_hash_format_chk" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "company_invitations_accepted_or_revoked_chk" CHECK (NOT ("accepted_at" IS NOT NULL AND "revoked_at" IS NOT NULL));
