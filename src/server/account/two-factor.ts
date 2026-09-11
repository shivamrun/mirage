import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { createOTP } from "@better-auth/utils/otp";
import {
  generateRandomString,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import db from "@/server/db";
import {
  createVerification,
  deleteExpiredVerifications,
  deleteVerification,
  deleteVerificationsByIdentifierPatterns,
} from "@/server/db/dal/email-change";
import {
  twoFactor as twoFactorTable,
  user as userTable,
  verification,
} from "@/server/db/schema";
import { sendTwoFactorEmailCode } from "@/server/email";
import type { AuthSession } from "@/server/routes/auth";

const EMAIL_CODE_PREFIX = "account-two-factor-email-code";
const EMAIL_CODE_EXPIRES_IN_MS = 1000 * 60 * 10;
const EMAIL_CODE_MAX_FAILED_ATTEMPTS = 5;
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

type TwoFactorAction = "enable" | "disable";

type TwoFactorMutationResult<T extends object = object> =
  | { kind: "error"; message: string; statusCode: number }
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

function timingSafeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
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

function parseEmailCodeValue(value: string): EmailCodeValue {
  try {
    const parsed = JSON.parse(value) as Partial<EmailCodeValue>;
    const failedAttempts = parsed.failedAttempts;

    if (
      typeof parsed.codeHash === "string" &&
      Number.isInteger(failedAttempts) &&
      typeof failedAttempts === "number" &&
      failedAttempts >= 0
    ) {
      return {
        codeHash: parsed.codeHash,
        failedAttempts,
      };
    }
  } catch {
    // Older in-flight records stored just the code hash.
  }

  return {
    codeHash: value,
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
  await deleteExpiredVerifications([`${EMAIL_CODE_PREFIX}:%`]);

  const identifier = getEmailCodeIdentifier(userId, action);
  const [record] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await deleteVerification(record.id);
    }

    return false;
  }

  const value = parseEmailCodeValue(record.value);

  if (value.failedAttempts >= EMAIL_CODE_MAX_FAILED_ATTEMPTS) {
    await deleteVerification(record.id);
    return false;
  }

  const expected = hashEmailCode({
    code: normalizeCode(code),
    identifier,
  });

  if (!timingSafeCompare(value.codeHash, expected)) {
    const failedAttempts = value.failedAttempts + 1;

    if (failedAttempts >= EMAIL_CODE_MAX_FAILED_ATTEMPTS) {
      await deleteVerification(record.id);
      return false;
    }

    await db
      .update(verification)
      .set({
        value: JSON.stringify({
          ...value,
          failedAttempts,
        }),
        updatedAt: new Date(),
      })
      .where(eq(verification.id, record.id));

    return false;
  }

  await deleteVerification(record.id);
  return true;
}

async function deleteTwoFactorRows(userId: string) {
  await db.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
}

async function updateTwoFactorEnabled(userId: string, enabled: boolean) {
  await db
    .update(userTable)
    .set({
      twoFactorEnabled: enabled,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));
}

async function getPendingTwoFactorSetup(userId: string) {
  const [record] = await db
    .select()
    .from(twoFactorTable)
    .where(
      and(
        eq(twoFactorTable.userId, userId),
        eq(twoFactorTable.verified, false),
      ),
    )
    .limit(1);

  return record ?? null;
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
  await db.insert(twoFactorTable).values({
    id: randomUUID(),
    backupCodes: encryptedBackupCodes,
    secret: encryptedSecret,
    userId: authSession.user.id,
    verified: false,
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
  const pendingSetup = await getPendingTwoFactorSetup(authSession.user.id);

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

  await db
    .update(twoFactorTable)
    .set({
      failedVerificationCount: 0,
      lockedUntil: null,
      verified: true,
    })
    .where(eq(twoFactorTable.id, pendingSetup.id));
  await updateTwoFactorEnabled(authSession.user.id, true);

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

  await deleteTwoFactorRows(authSession.user.id);
  await updateTwoFactorEnabled(authSession.user.id, false);

  return {
    kind: "success",
    twoFactorEnabled: false,
  };
}
