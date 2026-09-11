-- CreateTable
CREATE TABLE "user_totp_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_encrypted" VARCHAR(255) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "last_used_step" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_totp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_totp_credentials_user_id_key" ON "user_totp_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_recovery_codes_code_hash_key" ON "user_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "user_recovery_codes_user_id_idx" ON "user_recovery_codes"("user_id");

-- AddForeignKey
ALTER TABLE "user_totp_credentials" ADD CONSTRAINT "user_totp_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- Regras adicionais (SQL manual)
-- =============================================================================

-- Código de recuperação guardado apenas como HMAC-SHA256 hexadecimal.
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_hash_format_chk" CHECK ("code_hash" ~ '^[0-9a-f]{64}$');

-- Passo de tempo do TOTP nunca é negativo.
ALTER TABLE "user_totp_credentials" ADD CONSTRAINT "user_totp_credentials_step_chk" CHECK ("last_used_step" IS NULL OR "last_used_step" >= 0);
