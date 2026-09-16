import { symmetricDecrypt } from "better-auth/crypto";
import { normalizeRoles } from "@/features/auth/roles";
import { markAdminSessionAssurance } from "@/server/db/dal/admin-session-assurance";
import { getAuthUserById } from "@/server/db/dal/auth";
import {
  findVerifiedTwoFactor,
  getTwoFactorLockState,
  recordTwoFactorVerificationFailure,
  resetTwoFactorVerificationFailures,
} from "@/server/db/dal/two-factor";
import type { AccountMutationResult } from "@/server/db/services/account/results";
import type { AuthSession } from "@/server/db/services/auth/current-user";
import { verifyTotpCode } from "@/server/db/services/auth/totp";
import { env } from "@/shared/env";

const ACCOUNT_LOCKOUT_MAX_FAILED_ATTEMPTS = 10;
const ACCOUNT_LOCKOUT_DURATION_MS = 1000 * 60 * 15;

type AdminStepUpResult = AccountMutationResult;

export async function completeAdminTotpStepUp({
  authSession,
  code,
}: {
  authSession: AuthSession;
  code: string;
}): Promise<AdminStepUpResult> {
  const user = await getAuthUserById(authSession.user.id);

  if (
    !user?.emailVerified ||
    !user.twoFactorEnabled ||
    !normalizeRoles(user.role).includes("admin")
  ) {
    return {
      kind: "error",
      code: "forbidden",
      message: "Two-factor authentication is required.",
    };
  }

  const twoFactor = await findVerifiedTwoFactor(authSession.user.id);

  if (!twoFactor) {
    return {
      kind: "error",
      code: "forbidden",
      message: "Two-factor authentication is required.",
    };
  }

  const lockState = getTwoFactorLockState(twoFactor);

  if (lockState) {
    return {
      kind: "error",
      code: "rate-limited",
      message:
        "Too many invalid authenticator codes. Wait before trying again.",
      retryAfterSeconds: lockState.retryAfterSeconds,
    };
  }

  const secret = await symmetricDecrypt({
    data: twoFactor.secret,
    key: env.BETTER_AUTH_SECRET,
  });

  if (!(await verifyTotpCode(secret, code))) {
    await recordTwoFactorVerificationFailure({
      lockUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS),
      maxFailedAttempts: ACCOUNT_LOCKOUT_MAX_FAILED_ATTEMPTS,
      twoFactorId: twoFactor.id,
    });

    return {
      kind: "error",
      code: "invalid",
      message: "That authenticator code is invalid.",
    };
  }

  await resetTwoFactorVerificationFailures(twoFactor.id);
  await markAdminSessionAssurance({
    sessionId: authSession.session.id,
    userId: authSession.user.id,
  });

  return { kind: "success" };
}
