import { createHmac, randomInt, randomUUID } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import {
  generateRandomString,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import {
  logEmailDeliveryFailure,
  sendTwoFactorEmailCode,
} from "@/adapters/email";
import { consumeAccountEmailSendLimit } from "@/adapters/rate-limit";
import {
  createVerification,
  deleteVerificationsByIdentifierPatterns,
} from "@/server/db/dal/email-change";
import {
  completeTwoFactorSetup,
  createTwoFactorSetup,
  deleteTwoFactorRows,
  disableTwoFactorForUser,
  findPendingTwoFactorSetup,
  verifyAndConsumeEmailCode,
} from "@/server/db/dal/two-factor";
import type { AccountMutationResult } from "@/server/db/services/account/results";
import { createTwoFactorEmailCodeValue } from "@/server/db/services/account/verification-schemas";
import type { AuthSession } from "@/server/db/services/auth/current-user";
import {
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  verifyTotpCode,
} from "@/server/db/services/auth/totp";
import { env } from "@/shared/env";
import { siteConfig } from "@/shared/metadata";

const EMAIL_CODE_PREFIX = "account-two-factor-email-code";
const EMAIL_CODE_EXPIRES_IN_MS = 1000 * 60 * 10;
const EMAIL_CODE_MAX_FAILED_ATTEMPTS = 5;

type TwoFactorAction = "enable" | "disable";

type TwoFactorMutationResult<T extends object = object> =
  AccountMutationResult<T>;

function getTwoFactorEnabled(authSession: AuthSession) {
  return Boolean(
    (authSession.user as AuthSession["user"] & { twoFactorEnabled?: boolean })
      .twoFactorEnabled,
  );
}

function getEmailCodeIdentifier(userId: string, action: TwoFactorAction) {
  return `${EMAIL_CODE_PREFIX}:${userId}:${action}`;
}

function generateEmailCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function normalizeEmailCode(code: string) {
  return code.replace(/\s/g, "");
}

function hashEmailCode({
  code,
  identifier,
}: {
  code: string;
  identifier: string;
}) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${identifier}:${code}`)
    .digest("hex");
}

async function clearEmailCodes(userId: string) {
  await deleteVerificationsByIdentifierPatterns([
    `${EMAIL_CODE_PREFIX}:${userId}:%`,
  ]);
}

async function verifyEmailCode({
  action,
  code,
  userId,
}: {
  action: TwoFactorAction;
  code: string;
  userId: string;
}) {
  // Verification and attempt counting are serialized by the database.

  const identifier = getEmailCodeIdentifier(userId, action);
  return verifyAndConsumeEmailCode({
    expectedHash: hashEmailCode({ code: normalizeEmailCode(code), identifier }),
    identifier,
    maxFailedAttempts: EMAIL_CODE_MAX_FAILED_ATTEMPTS,
  });
}

export async function sendAccountTwoFactorEmailCode({
  action,
  authSession,
}: {
  action: TwoFactorAction;
  authSession: AuthSession;
}): Promise<TwoFactorMutationResult> {
  const isEnabled = getTwoFactorEnabled(authSession);

  if (action === "enable" && isEnabled) {
    return {
      kind: "error",
      code: "invalid",
      message: "Authenticator app sign-in is already enabled.",
    };
  }

  if (action === "disable" && !isEnabled) {
    return {
      kind: "error",
      code: "invalid",
      message: "Authenticator app sign-in is already disabled.",
    };
  }

  const rateLimit = await consumeAccountEmailSendLimit({
    accountId: authSession.user.id,
    destination: authSession.user.email,
    flow: "two-factor",
    variant: action,
  });
  if (!rateLimit.allowed) {
    return {
      kind: "error",
      code: "rate-limited",
      message: "Please wait before requesting another two-factor email code.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const code = generateEmailCode();
  const identifier = getEmailCodeIdentifier(authSession.user.id, action);
  const expiresAt = new Date(Date.now() + EMAIL_CODE_EXPIRES_IN_MS);

  await clearEmailCodes(authSession.user.id);
  await createVerification({
    id: randomUUID(),
    identifier,
    value: JSON.stringify(
      createTwoFactorEmailCodeValue(hashEmailCode({ code, identifier })),
    ),
    expiresAt,
  });

  try {
    await sendTwoFactorEmailCode({
      action,
      code,
      email: authSession.user.email,
      name: authSession.user.name,
    });
  } catch (error) {
    logEmailDeliveryFailure("two-factor-code", error);
    // The provider may have accepted a timed-out send. Keep the new code
    // valid, and never restore the old code after a replacement request.
    return {
      kind: "error",
      code: "delivery-failed",
      message:
        "We could not confirm code delivery. Your previous code is no longer valid; wait a minute and request a new code if this one does not arrive.",
      recovery: "try-delivered-code",
    };
  }

  return { kind: "success" };
}

export async function startAccountTwoFactorSetup({
  authSession,
  code,
}: {
  authSession: AuthSession;
  code: string;
}): Promise<TwoFactorMutationResult<{ totpURI: string }>> {
  if (getTwoFactorEnabled(authSession)) {
    return {
      kind: "error",
      code: "invalid",
      message: "Authenticator app sign-in is already enabled.",
    };
  }

  const isVerified = await verifyEmailCode({
    action: "enable",
    code,
    userId: authSession.user.id,
  });

  if (!isVerified) {
    return {
      kind: "error",
      code: "invalid",
      message: "That email code is invalid or expired.",
    };
  }

  const secret = generateRandomString(32);
  const encryptedSecret = await symmetricEncrypt({
    data: secret,
    key: env.BETTER_AUTH_SECRET,
  });
  const encryptedBackupCodes = await symmetricEncrypt({
    data: JSON.stringify([]),
    key: env.BETTER_AUTH_SECRET,
  });

  await deleteTwoFactorRows(authSession.user.id);
  await createTwoFactorSetup({
    id: randomUUID(),
    backupCodes: encryptedBackupCodes,
    secret: encryptedSecret,
    userId: authSession.user.id,
  });

  return {
    kind: "success",
    totpURI: createOTP(secret, {
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
    }).url(siteConfig.name, authSession.user.email),
  };
}

export async function verifyAccountTwoFactorSetup({
  authSession,
  code,
}: {
  authSession: AuthSession;
  code: string;
}): Promise<TwoFactorMutationResult<{ twoFactorEnabled: boolean }>> {
  const pendingSetup = await findPendingTwoFactorSetup(authSession.user.id);

  if (!pendingSetup) {
    return {
      kind: "error",
      code: "invalid",
      message: "Start setup again before verifying an authenticator code.",
    };
  }

  const secret = await symmetricDecrypt({
    data: pendingSetup.secret,
    key: env.BETTER_AUTH_SECRET,
  });

  if (!(await verifyTotpCode(secret, code))) {
    return {
      kind: "error",
      code: "invalid",
      message: "That authenticator code is invalid.",
    };
  }

  const completed = await completeTwoFactorSetup(
    authSession.user.id,
    pendingSetup.id,
  );
  if (!completed) {
    return {
      kind: "error",
      code: "invalid",
      message: "Start setup again before verifying an authenticator code.",
    };
  }

  return {
    kind: "success",
    twoFactorEnabled: true,
  };
}

export async function disableAccountTwoFactor({
  authSession,
  code,
}: {
  authSession: AuthSession;
  code: string;
}): Promise<TwoFactorMutationResult<{ twoFactorEnabled: boolean }>> {
  if (!getTwoFactorEnabled(authSession)) {
    return {
      kind: "error",
      code: "invalid",
      message: "Authenticator app sign-in is already disabled.",
    };
  }

  const isVerified = await verifyEmailCode({
    action: "disable",
    code,
    userId: authSession.user.id,
  });

  if (!isVerified) {
    return {
      kind: "error",
      code: "invalid",
      message: "That email code is invalid or expired.",
    };
  }

  await disableTwoFactorForUser(authSession.user.id);

  return {
    kind: "success",
    twoFactorEnabled: false,
  };
}
