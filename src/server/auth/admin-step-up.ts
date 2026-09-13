import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt } from "better-auth/crypto";

import type { AuthSession } from "@/lib/auth/current-user";
import { normalizeRoles } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { markAdminSessionAssurance } from "@/server/db/dal/admin-session-assurance";
import { getAuthUserById } from "@/server/db/dal/auth";
import {
  findVerifiedTwoFactor,
  getTwoFactorLockState,
  recordTwoFactorVerificationFailure,
  resetTwoFactorVerificationFailures,
} from "@/server/db/dal/two-factor";

const ACCOUNT_LOCKOUT_MAX_FAILED_ATTEMPTS = 10;
const ACCOUNT_LOCKOUT_DURATION_MS = 1000 * 60 * 15;
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

type AdminStepUpResult =
  | {
      kind: "error";
      message: string;
      retryAfterSeconds?: number;
      statusCode: 400 | 403;
    }
  | {
      kind: "error";
      message: string;
      retryAfterSeconds: number;
      statusCode: 429;
    }
  | {
      kind: "success";
    };

function normalizeCode(code: string) {
  return code.replace(/\s/g, "");
}

async function verifyTotpCode(secret: string, code: string) {
  const normalizedCode = normalizeCode(code);

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  return createOTP(secret, {
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  }).verify(normalizedCode, { window: TOTP_WINDOW_STEPS });
}

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
      message: "Two-factor authentication is required.",
      statusCode: 403,
    };
  }

  const twoFactor = await findVerifiedTwoFactor(authSession.user.id);

  if (!twoFactor) {
    return {
      kind: "error",
      message: "Two-factor authentication is required.",
      statusCode: 403,
    };
  }

  const lockState = getTwoFactorLockState(twoFactor);

  if (lockState) {
    return {
      kind: "error",
      message:
        "Too many invalid authenticator codes. Wait before trying again.",
      retryAfterSeconds: lockState.retryAfterSeconds,
      statusCode: 429,
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
      message: "That authenticator code is invalid.",
      statusCode: 400,
    };
  }

  await resetTwoFactorVerificationFailures(twoFactor.id);
  await markAdminSessionAssurance({
    sessionId: authSession.session.id,
    userId: authSession.user.id,
  });

  return { kind: "success" };
}
