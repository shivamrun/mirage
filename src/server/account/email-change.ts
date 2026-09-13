import { randomBytes, randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import type { AuthSession } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import {
  consumePendingAndUpdateUserEmail,
  createVerification,
  deleteExpiredVerifications,
  deleteVerification,
  deleteVerificationsByIdentifierPatterns,
  findActiveVerification,
  findUserByEmail,
  findVerificationByIdentifierPattern,
  replaceApprovalWithPending,
} from "@/server/db/dal/email-change";
import { logEmailDeliveryFailure, sendVerificationEmail } from "@/server/email";
import { consumeAccountEmailSendLimit } from "@/server/rate-limit";
import type { ChangeEmailValues } from "@/zod";

const EMAIL_CHANGE_PREFIX = "account-email-change";
const EMAIL_CHANGE_APPROVAL_PREFIX = "account-email-change-approval";
const EMAIL_CHANGE_EXPIRES_IN_MS = 1000 * 60 * 60;
const EMAIL_CHANGE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type PendingEmailChange = {
  currentEmail: string;
  newEmail: string;
  token: string;
  userId: string;
};

type AccountEmailState = {
  kind: "success";
  value: {
    email: string;
    emailVerified: boolean;
    pendingEmail: string | null;
    pendingEmailStep: "approve-current" | "verify-new" | null;
    pendingEmailExpiresAt: string | null;
  };
};

type AccountEmailMutationResult =
  | {
      kind: "error";
      message: string;
      retryAfterSeconds?: number;
      statusCode: number;
    }
  | {
      kind: "success";
      value: {
        email: string;
        emailVerified: boolean;
        pendingEmail: string | null;
        pendingEmailStep: "approve-current" | "verify-new" | null;
        pendingEmailExpiresAt: string | null;
      };
    };

type EmailChangeConfirmationResult = {
  deliveryFailed?: boolean;
  notificationEmail: string | null;
  notificationUserId: string | null;
  redirectURL: string;
  retryAfterSeconds?: number;
};

function createToken() {
  return randomBytes(32).toString("hex");
}

function isValidEmailChangeToken(token: string) {
  return EMAIL_CHANGE_TOKEN_PATTERN.test(token);
}

function getPendingIdentifierPrefix(userId: string) {
  return `${EMAIL_CHANGE_PREFIX}:${userId}:`;
}

function getPendingIdentifier(userId: string, token: string) {
  return `${getPendingIdentifierPrefix(userId)}${token}`;
}

function getApprovalIdentifierPrefix(userId: string) {
  return `${EMAIL_CHANGE_APPROVAL_PREFIX}:${userId}:`;
}

function getApprovalIdentifier(userId: string, token: string) {
  return `${getApprovalIdentifierPrefix(userId)}${token}`;
}

function parsePendingEmailChange(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PendingEmailChange>;

    if (
      typeof parsed.currentEmail !== "string" ||
      typeof parsed.newEmail !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }

    return parsed as PendingEmailChange;
  } catch {
    return null;
  }
}

async function getPendingEmailChange(userId: string) {
  await cleanupStaleEmailChanges(userId);

  const pendingChange = await findActiveVerification({
    identifierPatterns: [
      `${getPendingIdentifierPrefix(userId)}%`,
      `${getApprovalIdentifierPrefix(userId)}%`,
    ],
    expiresAfter: new Date(),
  });

  const parsed = parsePendingEmailChange(pendingChange?.value ?? null);

  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    expiresAt: pendingChange.expiresAt,
    step: pendingChange.identifier.startsWith(
      getApprovalIdentifierPrefix(userId),
    )
      ? ("approve-current" as const)
      : ("verify-new" as const),
  };
}

async function cleanupStaleEmailChanges(userId?: string) {
  await deleteExpiredVerifications(
    userId
      ? [
          `${getPendingIdentifierPrefix(userId)}%`,
          `${getApprovalIdentifierPrefix(userId)}%`,
        ]
      : [`${EMAIL_CHANGE_PREFIX}:%`, `${EMAIL_CHANGE_APPROVAL_PREFIX}:%`],
  );
}

async function clearPendingEmailChanges(userId: string) {
  await deleteVerificationsByIdentifierPatterns([
    `${getPendingIdentifierPrefix(userId)}%`,
    `${getApprovalIdentifierPrefix(userId)}%`,
  ]);
}

async function createPendingEmailChange({
  currentEmail,
  newEmail,
  userId,
}: {
  currentEmail: string;
  newEmail: string;
  userId: string;
}) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRES_IN_MS);
  const pendingChange: PendingEmailChange = {
    currentEmail,
    newEmail,
    token,
    userId,
  };

  await clearPendingEmailChanges(userId);
  await createVerification({
    id: randomUUID(),
    identifier: getPendingIdentifier(userId, token),
    value: JSON.stringify(pendingChange),
    expiresAt,
  });

  // A provider timeout can happen after acceptance. Keep this exact challenge
  // so a delivered link still works and the account owner can resend it.
  let deliveryFailed = false;
  try {
    await sendPendingEmailChangeConfirmation(pendingChange);
  } catch (error) {
    logEmailDeliveryFailure("email-change-confirmation", error);
    deliveryFailed = true;
  }

  return {
    ...pendingChange,
    deliveryFailed,
    expiresAt,
  };
}

async function sendPendingEmailChangeConfirmation(
  pendingChange: PendingEmailChange,
) {
  const confirmationURL = new URL(
    "/api/account/confirm-email-change",
    env.NEXT_PUBLIC_BASE_URL,
  );
  confirmationURL.searchParams.set("token", pendingChange.token);

  await sendVerificationEmail({
    actionLabel: "Confirm email change",
    email: pendingChange.newEmail,
    heading: "Confirm your new email",
    intro:
      "Use this link to confirm the email address for your Mirage account.",
    verificationUrl: confirmationURL.toString(),
  });
}

async function createPendingEmailChangeApproval({
  currentEmail,
  newEmail,
  userId,
}: {
  currentEmail: string;
  newEmail: string;
  userId: string;
}) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRES_IN_MS);
  const pendingChange: PendingEmailChange = {
    currentEmail,
    newEmail,
    token,
    userId,
  };

  await clearPendingEmailChanges(userId);
  await createVerification({
    id: randomUUID(),
    identifier: getApprovalIdentifier(userId, token),
    value: JSON.stringify(pendingChange),
    expiresAt,
  });

  const approvalURL = new URL(
    "/api/account/approve-email-change",
    env.NEXT_PUBLIC_BASE_URL,
  );
  approvalURL.searchParams.set("token", token);

  let deliveryFailed = false;
  try {
    await sendVerificationEmail({
      actionLabel: "Approve email change",
      email: currentEmail,
      heading: "Approve your email change",
      intro: `Approve changing your Mirage account email to ${newEmail}.`,
      verificationUrl: approvalURL.toString(),
    });
  } catch (error) {
    logEmailDeliveryFailure("email-change-approval", error);
    deliveryFailed = true;
  }

  return {
    ...pendingChange,
    deliveryFailed,
    expiresAt,
  };
}

function createAccountRedirectURL(
  status: "success" | "invalid" | "expired" | "pending",
) {
  const redirectURL = new URL("/account", env.NEXT_PUBLIC_BASE_URL);
  redirectURL.searchParams.set("emailChange", status);

  return redirectURL.toString();
}

export async function getAccountEmailState({
  authSession,
}: {
  authSession: AuthSession;
}): Promise<AccountEmailState> {
  const pendingChange = await getPendingEmailChange(authSession.user.id);

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: pendingChange?.newEmail ?? null,
      pendingEmailStep: pendingChange?.step ?? null,
      pendingEmailExpiresAt: pendingChange?.expiresAt.toISOString() ?? null,
    },
  };
}

export async function changeAccountEmail({
  authSession,
  body,
}: {
  authSession: AuthSession;
  body: ChangeEmailValues;
}): Promise<AccountEmailMutationResult> {
  if (body.newEmail === authSession.user.email) {
    return {
      kind: "error",
      message: "New email must be different from your current email.",
      statusCode: 400,
    };
  }

  const existingUser = await findUserByEmail(body.newEmail);

  if (existingUser) {
    return {
      kind: "error",
      message: "That email is already in use.",
      statusCode: 409,
    };
  }

  const deliveryDestination = authSession.user.emailVerified
    ? authSession.user.email
    : body.newEmail;
  const rateLimit = await consumeAccountEmailSendLimit({
    accountId: authSession.user.id,
    destination: deliveryDestination,
    flow: "email-change",
    variant: authSession.user.emailVerified ? "approval" : "confirmation",
  });
  if (!rateLimit.allowed) {
    return {
      kind: "error",
      message: "Please wait before requesting another email change message.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      statusCode: 429,
    };
  }

  const createPendingChange = authSession.user.emailVerified
    ? createPendingEmailChangeApproval
    : createPendingEmailChange;
  const pendingChange = await createPendingChange({
    currentEmail: authSession.user.email,
    newEmail: body.newEmail,
    userId: authSession.user.id,
  });

  if (pendingChange.deliveryFailed) {
    return {
      kind: "error",
      message: authSession.user.emailVerified
        ? "We could not confirm email delivery. Your change is pending; wait a minute, then start it again from your account if the approval message does not arrive."
        : "We could not confirm email delivery. Your change is pending; wait a minute, then resend verification from your account if the message does not arrive.",
      statusCode: 503,
    };
  }

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: pendingChange.newEmail,
      pendingEmailStep: authSession.user.emailVerified
        ? "approve-current"
        : "verify-new",
      pendingEmailExpiresAt: pendingChange.expiresAt.toISOString(),
    },
  };
}

export async function resolveEmailChangeApprovalRedirectURL({
  token,
}: {
  token: string;
}): Promise<EmailChangeConfirmationResult> {
  if (!isValidEmailChangeToken(token)) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  const approvalRecord = await findVerificationByIdentifierPattern(
    `${EMAIL_CHANGE_APPROVAL_PREFIX}:%:${token}`,
  );

  const pendingChange = parsePendingEmailChange(approvalRecord?.value ?? null);

  if (!approvalRecord || !pendingChange) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  if (approvalRecord.expiresAt < new Date()) {
    await deleteVerification(approvalRecord.id);

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("expired"),
    };
  }

  const existingUser = await findUserByEmail(pendingChange.newEmail);

  if (existingUser) {
    await deleteVerification(approvalRecord.id);

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  const rateLimit = await consumeAccountEmailSendLimit({
    accountId: pendingChange.userId,
    destination: pendingChange.newEmail,
    flow: "email-change",
    variant: "confirmation",
  });
  if (!rateLimit.allowed) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("pending"),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const newEmailChange: PendingEmailChange = {
    currentEmail: pendingChange.currentEmail,
    newEmail: pendingChange.newEmail,
    userId: pendingChange.userId,
    token: createToken(),
  };
  const claimed = await replaceApprovalWithPending({
    approvalId: approvalRecord.id,
    pending: {
      id: randomUUID(),
      identifier: getPendingIdentifier(
        newEmailChange.userId,
        newEmailChange.token,
      ),
      value: JSON.stringify(newEmailChange),
      expiresAt: new Date(Date.now() + EMAIL_CHANGE_EXPIRES_IN_MS),
    },
  });

  if (!claimed) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  try {
    await sendPendingEmailChangeConfirmation(newEmailChange);
  } catch (error) {
    logEmailDeliveryFailure("email-change-transition", error);
    return {
      deliveryFailed: true,
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("pending"),
    };
  }

  return {
    notificationEmail: newEmailChange.newEmail,
    notificationUserId: newEmailChange.userId,
    redirectURL: createAccountRedirectURL("pending"),
  };
}

export async function cancelPendingEmailChange({
  authSession,
}: {
  authSession: AuthSession;
}): Promise<AccountEmailMutationResult> {
  await clearPendingEmailChanges(authSession.user.id);

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: null,
      pendingEmailStep: null,
      pendingEmailExpiresAt: null,
    },
  };
}

export async function resendPendingEmailChangeVerification({
  authSession,
}: {
  authSession: AuthSession;
}): Promise<AccountEmailMutationResult> {
  const pendingChange = await getPendingEmailChange(authSession.user.id);

  if (!pendingChange || pendingChange.step !== "verify-new") {
    return {
      kind: "error",
      message: "No pending email verification is ready to resend.",
      statusCode: 400,
    };
  }

  const rateLimit = await consumeAccountEmailSendLimit({
    accountId: authSession.user.id,
    destination: pendingChange.newEmail,
    flow: "email-change",
    variant: "confirmation",
  });
  if (!rateLimit.allowed) {
    return {
      kind: "error",
      message: "Please wait before requesting another email change message.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      statusCode: 429,
    };
  }

  try {
    await sendPendingEmailChangeConfirmation(pendingChange);
  } catch (error) {
    logEmailDeliveryFailure("email-change-resend", error);
    return {
      kind: "error",
      message:
        "We could not confirm email delivery. Your verification is still pending; wait a minute and resend if the message does not arrive.",
      statusCode: 503,
    };
  }

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: pendingChange.newEmail,
      pendingEmailStep: pendingChange.step,
      pendingEmailExpiresAt: pendingChange.expiresAt.toISOString(),
    },
  };
}

export async function resendAccountVerification({
  authSession,
  headers,
}: {
  authSession: AuthSession;
  headers: Headers;
}): Promise<AccountEmailMutationResult> {
  if (authSession.user.emailVerified) {
    return {
      kind: "error",
      message: "Email is already verified.",
      statusCode: 400,
    };
  }

  const rateLimit = await consumeAccountEmailSendLimit({
    accountId: authSession.user.id,
    destination: authSession.user.email,
    flow: "email-verification",
  });
  if (!rateLimit.allowed) {
    return {
      kind: "error",
      message: "Please wait before requesting another verification email.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      statusCode: 429,
    };
  }

  await auth.api.sendVerificationEmail({
    body: {
      callbackURL: "/email-verification?status=success",
      email: authSession.user.email,
    },
    headers,
  });

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: null,
      pendingEmailStep: null,
      pendingEmailExpiresAt: null,
    },
  };
}

export async function resolveEmailChangeConfirmationRedirectURL({
  token,
}: {
  token: string;
}): Promise<EmailChangeConfirmationResult> {
  if (!isValidEmailChangeToken(token)) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  const pendingChangeRecord = await findVerificationByIdentifierPattern(
    `${EMAIL_CHANGE_PREFIX}:%:${token}`,
  );

  const pendingChange = parsePendingEmailChange(
    pendingChangeRecord?.value ?? null,
  );

  if (!pendingChangeRecord || !pendingChange) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  if (pendingChangeRecord.expiresAt < new Date()) {
    await deleteVerification(pendingChangeRecord.id);

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("expired"),
    };
  }

  const existingUser = await findUserByEmail(pendingChange.newEmail);

  if (existingUser) {
    await deleteVerification(pendingChangeRecord.id);

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  const updated = await consumePendingAndUpdateUserEmail({
    currentEmail: pendingChange.currentEmail,
    identifierPatterns: [
      `${getPendingIdentifierPrefix(pendingChange.userId)}%`,
      `${getApprovalIdentifierPrefix(pendingChange.userId)}%`,
    ],
    newEmail: pendingChange.newEmail,
    pendingId: pendingChangeRecord.id,
    userId: pendingChange.userId,
  });

  if (!updated) {
    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  return {
    notificationEmail: pendingChange.newEmail,
    notificationUserId: pendingChange.userId,
    redirectURL: createAccountRedirectURL("success"),
  };
}
