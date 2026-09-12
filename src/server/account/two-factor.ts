import { createHmac, randomInt, randomUUID } from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import {
  generateRandomString,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
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
import { sendTwoFactorEmailCode } from "@/server/email";
import { consumeAccountEmailSendLimit } from "@/server/rate-limit";
import type { AuthSession } from "@/server/routes/auth";

const EMAIL_CODE_PREFIX = "account-two-factor-email-code";
const EMAIL_CODE_EXPIRES_IN_MS = 1000 * 60 * 10;
const EMAIL_CODE_MAX_FAILED_ATTEMPTS = 5;
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

type TwoFactorAction = "enable" | "disable";

type TwoFactorMutationResult<T extends object = object> =
  | {
      kind: "error";
      message: string;
      retryAfterSeconds?: number;
      statusCode: number;
    }
  | ({ kind: "success" } & T);

type EmailCodeValue = {
  codeHash: string;
  failedAttempts: number;
};

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

function normalizeCode(code: string) {
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

function createEmailCodeValue(codeHash: string): EmailCodeValue {
  return {
    codeHash,
    failedAttempts: 0,
  };
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
    expectedHash: hashEmailCode({ code: normalizeCode(code), identifier }),
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
      message: "Authenticator app sign-in is already enabled.",
      statusCode: 400,
    };
  }

  if (action === "disable" && !isEnabled) {
    return {
      kind: "error",
      message: "Authenticator app sign-in is already disabled.",
      statusCode: 400,
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
      message: "Please wait before requesting another two-factor email code.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      statusCode: 429,
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
      createEmailCodeValue(hashEmailCode({ code, identifier })),
    ),
    expiresAt,
  });

  await sendTwoFactorEmailCode({
    action,
    code,
    email: authSession.user.email,
    name: authSession.user.name,
  });

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
      message: "Authenticator app sign-in is already enabled.",
      statusCode: 400,
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
      message: "That email code is invalid or expired.",
      statusCode: 400,
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
      message: "Start setup again before verifying an authenticator code.",
      statusCode: 400,
    };
  }

  const secret = await symmetricDecrypt({
    data: pendingSetup.secret,
    key: env.BETTER_AUTH_SECRET,
  });

  if (!(await verifyTotpCode(secret, code))) {
    return {
      kind: "error",
      message: "That authenticator code is invalid.",
      statusCode: 400,
    };
  }

  const completed = await completeTwoFactorSetup(
    authSession.user.id,
    pendingSetup.id,
  );
  if (!completed) {
    return {
      kind: "error",
      message: "Start setup again before verifying an authenticator code.",
      statusCode: 400,
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
      message: "Authenticator app sign-in is already disabled.",
      statusCode: 400,
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
      message: "That email code is invalid or expired.",
      statusCode: 400,
    };
  }

  await disableTwoFactorForUser(authSession.user.id);

  return {
    kind: "success",
    twoFactorEnabled: false,
  };
}
