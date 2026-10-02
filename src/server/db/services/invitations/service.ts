import { createHmac, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { logEmailDeliveryFailure } from "@/adapters/email";
import { auth } from "@/features/auth/better-auth/server";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import {
  authRoles,
  normalizeRoles,
  type RoleValue,
} from "@/features/auth/roles";
import db from "@/server/db";
import { getAuthUserByEmail, getAuthUserById } from "@/server/db/dal/auth";
import {
  claimPendingInvitationForUser,
  createInvitationRecord,
  deletePartialInvitationUser,
  findActivePendingInvitationByEmail,
  findInvitationById,
  findInvitationByIdForUpdate,
  findInvitationByTokenHash,
  findInvitationByTokenHashForUpdate,
  type InvitationRecord,
  revokeActivePendingInvitation,
  revokeSessionsForUser,
  rotateActivePendingInvitationToken,
  setUserRole,
} from "@/server/db/dal/invitations";
import { deleteBillingCustomer } from "@/server/db/services/billing/customer-lifecycle";
import { notify } from "@/server/db/services/notifications/service";
import { env } from "@/shared/env";
import { emailSchema } from "@/shared/schemas/helpers/email";
import type { PublicInvitationValidationStatus } from "@/shared/schemas/invitations";

export const INVITATION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 7;

export type InvitationCreateResult =
  | {
      invitation: InvitationRecord;
      status: "success";
      token: string;
    }
  | {
      status:
        | "duplicate-active-invitation"
        | "existing-user"
        | "invalid-email"
        | "invalid-role";
    };

type CreateInvitationOptions = {
  email: string;
  invitedByUserId: string;
  role?: RoleValue;
};

type CreateAndSendInvitationResult =
  | InvitationCreateResult
  | {
      invitation: InvitationRecord;
      status: "email-delivery-failed";
    };

export type InvitationMutationResult =
  | {
      invitation: InvitationRecord;
      status: "success";
    }
  | {
      status: "not-found" | "not-pending";
    };

export type InvitationResendResult =
  | {
      invitation: InvitationRecord;
      status: "success";
      token: string;
    }
  | {
      invitation: InvitationRecord;
      status: "email-delivery-failed";
      token: string;
    }
  | {
      status: "existing-user" | "not-found" | "not-pending";
    };

type InvitationSignupResult =
  | {
      headers: Headers;
      redirectTo: string;
      status: "success";
    }
  | {
      message: string;
      status:
        | "acceptance-failed"
        | "email-mismatch"
        | "existing-user"
        | "invalid"
        | "signup-failed";
      statusCode: 400 | 409 | 422 | 500;
    };

const authRoleSet = new Set<string>(authRoles);

class InvitationAcceptanceConflictError extends Error {}

export function createInvitationToken() {
  return randomBytes(32).toString("hex");
}

export function hashInvitationToken(token: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(token)
    .digest("hex");
}

export function getEffectiveInvitationStatus(
  invitation: Pick<InvitationRecord, "expiresAt" | "status">,
  now = new Date(),
) {
  if (
    invitation.status === "pending" &&
    invitation.expiresAt.getTime() <= now.getTime()
  ) {
    return "expired" as const;
  }

  return invitation.status;
}

export function buildInvitationAcceptUrl(token: string) {
  const url = new URL("/invite/accept", env.NEXT_PUBLIC_BASE_URL);
  url.hash = new URLSearchParams({ token }).toString();

  return url.toString();
}

function normalizeInvitationRole(role: RoleValue | undefined) {
  if (role == null) {
    return "user" as const;
  }

  const roleValues = Array.isArray(role) ? role : role.split(",");
  const hasInvalidRole = roleValues.some(
    (value) => !authRoleSet.has(value.trim()),
  );

  if (hasInvalidRole) {
    return null;
  }

  return normalizeRoles(role).join(",");
}

export async function createInvitation({
  email,
  invitedByUserId,
  role,
}: CreateInvitationOptions): Promise<InvitationCreateResult> {
  const parsedEmail = emailSchema.safeParse(email);

  if (!parsedEmail.success) {
    return { status: "invalid-email" };
  }

  const normalizedEmail = parsedEmail.data;
  const normalizedRole = normalizeInvitationRole(role);

  if (!normalizedRole) {
    return { status: "invalid-role" };
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${normalizedEmail}))`,
    );

    const existingUser = await getAuthUserByEmail(normalizedEmail, tx);

    if (existingUser) {
      return { status: "existing-user" };
    }

    const now = new Date();
    const activeInvitation = await findActivePendingInvitationByEmail({
      email: normalizedEmail,
      executor: tx,
      now,
    });

    if (activeInvitation) {
      return { status: "duplicate-active-invitation" };
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(now.getTime() + INVITATION_EXPIRES_IN_MS);
    const invitation = await createInvitationRecord(
      {
        email: normalizedEmail,
        expiresAt,
        invitedByUserId,
        role: normalizedRole,
        status: "pending",
        tokenHash,
      },
      tx,
    );

    return {
      invitation,
      status: "success",
      token,
    };
  });
}

export async function createInvitationAndSendEmail({
  email,
  invitedByUserId,
  role,
}: CreateInvitationOptions): Promise<CreateAndSendInvitationResult> {
  const result = await createInvitation({ email, invitedByUserId, role });

  if (result.status !== "success") {
    return result;
  }

  try {
    await notify({
      data: {
        acceptUrl: buildInvitationAcceptUrl(result.token),
        email: result.invitation.email,
        expiresAt: result.invitation.expiresAt.toISOString(),
      },
      idempotencyKey: `invitation:${result.invitation.id}:created`,
      subject: {
        id: result.invitation.id,
        type: "invitation",
      },
      type: "auth.invitation",
    });

    return result;
  } catch (error) {
    logEmailDeliveryFailure("auth-invitation", error);

    try {
      await revokeActivePendingInvitation({
        expectedTokenHash: result.invitation.tokenHash,
        id: result.invitation.id,
      });
    } catch (revokeError) {
      console.error(
        "Invitation email delivery failed and invitation revoke also failed.",
        revokeError,
      );
    }

    return {
      invitation: result.invitation,
      status: "email-delivery-failed",
    };
  }
}

function isEffectivelyPending(invitation: InvitationRecord, now = new Date()) {
  return getEffectiveInvitationStatus(invitation, now) === "pending";
}

async function sendInvitationEmail({
  invitation,
  token,
  variant,
}: {
  invitation: InvitationRecord;
  token: string;
  variant: "created" | "resent";
}) {
  await notify({
    data: {
      acceptUrl: buildInvitationAcceptUrl(token),
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    },
    idempotencyKey: `invitation:${invitation.id}:${variant}:${invitation.tokenHash}`,
    subject: {
      id: invitation.id,
      type: "invitation",
    },
    type: "auth.invitation",
  });
}

export async function resendInvitationEmail({
  id,
}: {
  id: string;
}): Promise<InvitationResendResult> {
  const initial = await findInvitationById(id);
  if (!initial) {
    return { status: "not-found" };
  }

  const initialUpdatedAt = initial.updatedAt.getTime();
  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  try {
    return await db.transaction(async (tx) => {
      const current = await findInvitationByIdForUpdate(id, tx);

      if (!current) {
        return { status: "not-found" };
      }

      const now = new Date();
      if (!isEffectivelyPending(current, now)) {
        return { status: "not-pending" };
      }

      if (current.updatedAt.getTime() !== initialUpdatedAt) {
        return { status: "not-pending" };
      }

      if (await getAuthUserByEmail(current.email)) {
        await revokeActivePendingInvitation({
          executor: tx,
          expectedTokenHash: current.tokenHash,
          id,
          now,
        });
        return { status: "existing-user" };
      }

      const rotated = await rotateActivePendingInvitationToken({
        executor: tx,
        expectedTokenHash: current.tokenHash,
        expiresAt: new Date(now.getTime() + INVITATION_EXPIRES_IN_MS),
        id,
        now,
        tokenHash,
      });

      if (!rotated) {
        return { status: "not-pending" };
      }

      await sendInvitationEmail({
        invitation: rotated,
        token,
        variant: "resent",
      });

      return {
        invitation: rotated,
        status: "success",
        token,
      };
    });
  } catch (error) {
    logEmailDeliveryFailure("auth-invitation-resend", error);

    const current = await findInvitationById(id);
    if (!current) {
      return { status: "not-found" };
    }

    return {
      invitation: current,
      status: "email-delivery-failed",
      token,
    };
  }
}

export async function revokeInvitation({
  id,
}: {
  id: string;
}): Promise<InvitationMutationResult> {
  const current = await findInvitationById(id);

  if (!current) {
    return { status: "not-found" };
  }

  const now = new Date();

  if (!isEffectivelyPending(current, now)) {
    return { status: "not-pending" };
  }

  const revoked = await revokeActivePendingInvitation({
    expectedTokenHash: current.tokenHash,
    id,
    now,
  });

  if (!revoked) {
    return { status: "not-pending" };
  }

  return {
    invitation: revoked,
    status: "success",
  };
}

export async function validateInvitationToken(
  token: string,
  { revokeForExistingUser = true } = {},
): Promise<{
  email?: string;
  status: PublicInvitationValidationStatus;
  valid: boolean;
}> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return { status: "invalid", valid: false };
  }

  const record = await findInvitationByTokenHash(
    hashInvitationToken(normalizedToken),
  );

  if (!record) {
    return { status: "invalid", valid: false };
  }

  const status = getEffectiveInvitationStatus(record);

  if (status !== "pending") {
    return { status, valid: false };
  }

  const existingUser = await getAuthUserByEmail(record.email);

  if (existingUser) {
    if (revokeForExistingUser) {
      await revokeActivePendingInvitation({
        expectedTokenHash: record.tokenHash,
        id: record.id,
      });
    }
    return { status: "invalid", valid: false };
  }

  return {
    email: record.email,
    status: "valid",
    valid: true,
  };
}

async function signUpInvitedUser({
  email,
  headers,
  password,
}: {
  email: string;
  headers: Headers;
  password: string;
}) {
  const name = email.slice(0, email.indexOf("@"));

  return auth.api.signUpEmail({
    body: {
      agreeToTerms: true,
      callbackURL: "/email-verification?status=success",
      email,
      name,
      password,
    },
    headers,
    returnHeaders: true,
    returnStatus: true,
  } as Parameters<typeof auth.api.signUpEmail>[0] & {
    returnHeaders: true;
    returnStatus: true;
  });
}

async function lockDownFailedInvitationSignup(userId: string) {
  try {
    await db.transaction(async (tx) => {
      await setUserRole({ executor: tx, role: "user", userId });
      await revokeSessionsForUser(userId, tx);
    });
  } catch (error) {
    console.error("Invitation signup recovery failed.", { error, userId });
  }
}

async function cleanupFailedInvitationSignup({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const createdUser = await getAuthUserById(userId);

  if (
    !createdUser ||
    createdUser.email !== email ||
    createdUser.emailVerified ||
    createdUser.role !== "user"
  ) {
    await lockDownFailedInvitationSignup(userId);
    return false;
  }

  try {
    if (createdUser.stripeCustomerId) {
      await deleteBillingCustomer(createdUser.stripeCustomerId);
    }

    const deleted = await deletePartialInvitationUser({ email, userId });

    if (deleted) {
      return true;
    }
  } catch (error) {
    console.error("Invitation signup cleanup failed.", { error, userId });
  }

  await lockDownFailedInvitationSignup(userId);
  return false;
}

export async function acceptInvitationSignup({
  callbackURL,
  email,
  headers,
  password,
  token,
}: {
  callbackURL?: string;
  email: string;
  headers: Headers;
  password: string;
  token: string;
}): Promise<InvitationSignupResult> {
  const parsedEmail = emailSchema.safeParse(email);

  if (!parsedEmail.success) {
    return {
      message: "Invalid invitation request.",
      status: "invalid",
      statusCode: 400,
    };
  }

  const normalizedEmail = parsedEmail.data;
  const tokenHash = hashInvitationToken(token);
  const preflight = await validateInvitationToken(token, {
    revokeForExistingUser: false,
  });

  if (!preflight.valid || !preflight.email) {
    const record = await findInvitationByTokenHash(tokenHash);
    if (
      record &&
      isEffectivelyPending(record) &&
      (await getAuthUserByEmail(record.email))
    ) {
      await revokeActivePendingInvitation({
        expectedTokenHash: record.tokenHash,
        id: record.id,
      });
      return {
        message: "A user with this email already exists.",
        status: "existing-user",
        statusCode: 409,
      };
    }

    return {
      message: "This invitation is no longer available.",
      status: "invalid",
      statusCode: 400,
    };
  }

  if (preflight.email !== normalizedEmail) {
    return {
      message: "This invitation is for a different email address.",
      status: "email-mismatch",
      statusCode: 400,
    };
  }

  try {
    const existingUser = await getAuthUserByEmail(normalizedEmail);

    if (existingUser) {
      return {
        message: "This invitation is no longer available.",
        status: "existing-user",
        statusCode: 409,
      };
    }

    const signup = await signUpInvitedUser({
      email: normalizedEmail,
      headers,
      password,
    });
    const signupUser =
      signup.response &&
      typeof signup.response === "object" &&
      "user" in signup.response
        ? signup.response.user
        : null;
    const userId =
      signupUser &&
      typeof signupUser === "object" &&
      "id" in signupUser &&
      typeof signupUser.id === "string"
        ? signupUser.id
        : null;

    if (!userId) {
      return {
        message: "Account signup failed.",
        status: "signup-failed",
        statusCode: 422,
      };
    }

    try {
      await db.transaction(async (tx) => {
        const invitation = await findInvitationByTokenHashForUpdate(
          tokenHash,
          tx,
        );

        if (!invitation) {
          throw new InvitationAcceptanceConflictError(
            "Invitation disappeared during acceptance.",
          );
        }

        if (invitation.email !== normalizedEmail) {
          throw new InvitationAcceptanceConflictError(
            "Invitation email mismatch during acceptance.",
          );
        }

        const existingUserAfterSignup = await getAuthUserByEmail(
          normalizedEmail,
          tx,
        );

        if (!existingUserAfterSignup || existingUserAfterSignup.id !== userId) {
          throw new InvitationAcceptanceConflictError(
            "Invitation signup user mismatch during acceptance.",
          );
        }

        const canonicalRole = normalizeInvitationRole(invitation.role);
        if (!canonicalRole || canonicalRole !== invitation.role) {
          throw new Error("Invitation role is not canonical.");
        }

        const claimed = await claimPendingInvitationForUser({
          email: normalizedEmail,
          executor: tx,
          tokenHash,
          userId,
        });

        if (!claimed) {
          throw new InvitationAcceptanceConflictError(
            "Invitation was not claimable during acceptance.",
          );
        }

        const updatedUser = await setUserRole({
          executor: tx,
          role: canonicalRole,
          userId,
        });
        if (!updatedUser) {
          throw new InvitationAcceptanceConflictError(
            "Invitation signup user disappeared during acceptance.",
          );
        }
      });
    } catch (error) {
      console.error("Invitation acceptance failed after user signup.", {
        error,
        userId,
      });
      const cleanedUp = await cleanupFailedInvitationSignup({
        email: normalizedEmail,
        userId,
      });
      const isConflict = error instanceof InvitationAcceptanceConflictError;

      return {
        message:
          cleanedUp && isConflict
            ? "The invitation changed while signup was completing. Please use the latest invitation link."
            : "Your account was created, but the invitation could not be accepted. Contact support before signing in.",
        status: "acceptance-failed",
        statusCode: cleanedUp && isConflict ? 409 : 500,
      };
    }

    return {
      headers: signup.headers ?? new Headers(),
      redirectTo: getSafeAuthRedirect(callbackURL || "/account"),
      status: "success",
    };
  } catch {
    const existingUser = await getAuthUserByEmail(normalizedEmail);
    if (existingUser) {
      return {
        message: "A user with this email already exists.",
        status: "existing-user",
        statusCode: 409,
      };
    }

    return {
      message: "Invitation signup failed.",
      status: "signup-failed",
      statusCode: 422,
    };
  }
}
