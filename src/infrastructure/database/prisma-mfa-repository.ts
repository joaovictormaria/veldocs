import type { MfaRepository } from "@/application/ports/mfa";
import type { PrismaClient } from "@/generated/prisma/client";
import { createFieldEncryptor } from "@/infrastructure/security/crypto";
import type { ApplicationKeys } from "@/infrastructure/security/token-service";

/** O segredo TOTP fica cifrado (AES-256-GCM) e só é decifrado aqui. */
export function createPrismaMfaRepository(prisma: PrismaClient, keys: ApplicationKeys): MfaRepository {
  const cipher = createFieldEncryptor(Buffer.from(keys.APP_ENCRYPTION_KEY, "base64"), "users.totp_secret");

  return {
    async findCredential(userId) {
      const row = await prisma.userTotpCredential.findUnique({
        where: { userId },
        select: { confirmedAt: true },
      });
      return row ? { confirmed: row.confirmedAt !== null } : null;
    },

    async findSecret(userId) {
      const row = await prisma.userTotpCredential.findUnique({
        where: { userId },
        select: { secretEncrypted: true, confirmedAt: true, lastUsedStep: true },
      });
      if (!row) return null;
      return {
        secret: cipher.decrypt(row.secretEncrypted),
        confirmed: row.confirmedAt !== null,
        lastUsedStep: row.lastUsedStep,
      };
    },

    async startEnrollment(userId, secret) {
      const secretEncrypted = cipher.encrypt(secret);
      await prisma.userTotpCredential.upsert({
        where: { userId },
        create: { userId, secretEncrypted },
        update: { secretEncrypted, confirmedAt: null, lastUsedStep: null },
      });
    },

    async confirmEnrollment(userId, at, step) {
      await prisma.userTotpCredential.update({
        where: { userId },
        data: { confirmedAt: at, lastUsedStep: step },
      });
    },

    async recordUsedStep(userId, step) {
      await prisma.userTotpCredential.update({ where: { userId }, data: { lastUsedStep: step } });
    },

    async replaceRecoveryCodes(userId, codeHashes) {
      await prisma.$transaction([
        prisma.userRecoveryCode.deleteMany({ where: { userId } }),
        prisma.userRecoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) }),
      ]);
    },

    async consumeRecoveryCode(userId, codeHash, at) {
      const { count } = await prisma.userRecoveryCode.updateMany({
        where: { userId, codeHash, usedAt: null },
        data: { usedAt: at },
      });
      return count === 1;
    },

    countUnusedRecoveryCodes(userId) {
      return prisma.userRecoveryCode.count({ where: { userId, usedAt: null } });
    },
  };
}
