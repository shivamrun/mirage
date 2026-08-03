import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, like, lte } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import db from "@/server/db";
import { user, verification } from "@/server/db/schema";
import { sendVerificationEmail } from "@/server/email";
import type { AuthSession } from "@/server/routes/auth";
import type { ChangeEmailValues } from "@/zod";

const EMAIL_CHANGE_PREFIX = "account-email-change";
const EMAIL_CHANGE_EXPIRES_IN_MS = 1000 * 60 * 60;

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
    pendingEmailExpiresAt: string | null;
  };
};

type AccountEmailMutationResult =
  | { kind: "error"; message: string; statusCode: number }
  | {
      kind: "success";
      value: {
        email: string;
        emailVerified: boolean;
        pendingEmail: string | null;
        pendingEmailExpiresAt: string | null;
      };
    };

type EmailChangeConfirmationResult = {
  notificationEmail: string | null;
  notificationUserId: string | null;
  redirectURL: string;
};

function createToken() {
  return randomBytes(32).toString("hex");
}

function getPendingIdentifierPrefix(userId: string) {
  return `${EMAIL_CHANGE_PREFIX}:${userId}:`;
}

function getPendingIdentifier(userId: string, token: string) {
  return `${getPendingIdentifierPrefix(userId)}${token}`;
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

  const [pendingChange] = await db
    .select({
      expiresAt: verification.expiresAt,
      value: verification.value,
    })
    .from(verification)
    .where(
      and(
        like(verification.identifier, `${getPendingIdentifierPrefix(userId)}%`),
        gt(verification.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const parsed = parsePendingEmailChange(pendingChange?.value ?? null);

  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    expiresAt: pendingChange.expiresAt,
  };
}

async function cleanupStaleEmailChanges(userId?: string) {
  const conditions = [lte(verification.expiresAt, new Date())];

  if (userId) {
    conditions.push(
      like(verification.identifier, `${getPendingIdentifierPrefix(userId)}%`),
    );
  } else {
    conditions.push(like(verification.identifier, `${EMAIL_CHANGE_PREFIX}:%`));
  }

  await db.delete(verification).where(and(...conditions));
}

async function clearPendingEmailChanges(userId: string) {
  await db
    .delete(verification)
    .where(
      like(verification.identifier, `${getPendingIdentifierPrefix(userId)}%`),
    );
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
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: getPendingIdentifier(userId, token),
    value: JSON.stringify(pendingChange),
    expiresAt,
  });

  const confirmationURL = new URL(
    "/api/account/confirm-email-change",
    env.NEXT_PUBLIC_BASE_URL,
  );
  confirmationURL.searchParams.set("token", token);

  await sendVerificationEmail({
    actionLabel: "Confirm email change",
    email: newEmail,
    heading: "Confirm your new email",
    intro: "Use this link to confirm the email address for your Grove account.",
    verificationUrl: confirmationURL.toString(),
  });

  return {
    ...pendingChange,
    expiresAt,
  };
}

function createAccountRedirectURL(status: "success" | "invalid" | "expired") {
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

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, body.newEmail))
    .limit(1);

  if (existingUser) {
    return {
      kind: "error",
      message: "That email is already in use.",
      statusCode: 409,
    };
  }

  const pendingChange = await createPendingEmailChange({
    currentEmail: authSession.user.email,
    newEmail: body.newEmail,
    userId: authSession.user.id,
  });

  return {
    kind: "success",
    value: {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      pendingEmail: pendingChange.newEmail,
      pendingEmailExpiresAt: pendingChange.expiresAt.toISOString(),
    },
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
      pendingEmailExpiresAt: null,
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
      pendingEmailExpiresAt: null,
    },
  };
}

export async function resolveEmailChangeConfirmationRedirectURL({
  token,
}: {
  token: string;
}): Promise<EmailChangeConfirmationResult> {
  await cleanupStaleEmailChanges();

  const [pendingChangeRecord] = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `${EMAIL_CHANGE_PREFIX}:%:${token}`))
    .limit(1);

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
    await db
      .delete(verification)
      .where(eq(verification.id, pendingChangeRecord.id));

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("expired"),
    };
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, pendingChange.newEmail))
    .limit(1);

  if (existingUser) {
    await db
      .delete(verification)
      .where(eq(verification.id, pendingChangeRecord.id));

    return {
      notificationEmail: null,
      notificationUserId: null,
      redirectURL: createAccountRedirectURL("invalid"),
    };
  }

  await db
    .update(user)
    .set({
      email: pendingChange.newEmail,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, pendingChange.userId));
  await clearPendingEmailChanges(pendingChange.userId);

  return {
    notificationEmail: pendingChange.newEmail,
    notificationUserId: pendingChange.userId,
    redirectURL: createAccountRedirectURL("success"),
  };
}
