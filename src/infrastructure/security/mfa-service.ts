import type { MfaService } from "@/application/ports/mfa";
import { RECOVERY_CODE_LENGTH } from "@/domain/identity/recovery-code";
import { buildTotpKeyUri, generateRecoveryCode, generateTotpSecret, verifyTotpCode } from "./totp";

/** Nome exibido no app autenticador. */
const ISSUER = "VELDOCS";

export function createMfaService(issuer: string = ISSUER): MfaService {
  return {
    generateSecret: () => generateTotpSecret(),
    keyUri: ({ secret, accountName }) => buildTotpKeyUri({ issuer, accountName, secret }),
    verifyTotp: (input) => verifyTotpCode(input),
    generateRecoveryCodes: (count) =>
      Array.from({ length: count }, () => generateRecoveryCode(RECOVERY_CODE_LENGTH)),
  };
}
