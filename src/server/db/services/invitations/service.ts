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
import { getAuthUserByEmail } from "@/server/db/dal/auth";
import {
  claimPendingInvitationForUser,
  createInvitationRecord,
  findActivePendingInvitationByEmail,
  findInvitationByTokenHash,
  findInvitationByTokenHashForUpdate,
  type InvitationRecord,
  markInvitationRevoked,
  revokeSessionsForUser,
  setUserRole,
} from "@/server/db/dal/invitations";
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
  url.searchParams.set("token", token);

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
      await markInvitationRevoked({ id: result.invitation.id });
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

export async function validateInvitationToken(token: string): Promise<{
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

async function recoverFailedInvitationSignup(userId: string) {
  try {
    await db.transaction(async (tx) => {
      await setUserRole({ executor: tx, role: "user", userId });
      await revokeSessionsForUser(userId, tx);
    });
  } catch (error) {
    console.error("Invitation signup recovery failed.", { error, userId });
  }
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
  const preflight = await validateInvitationToken(token);

  if (!preflight.valid || !preflight.email) {
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
          throw new Error("Invitation disappeared during acceptance.");
        }

        if (invitation.email !== normalizedEmail) {
          throw new Error("Invitation email mismatch during acceptance.");
        }

        const existingUserAfterSignup = await getAuthUserByEmail(
          normalizedEmail,
          tx,
        );

        if (!existingUserAfterSignup || existingUserAfterSignup.id !== userId) {
          throw new Error("Invitation signup user mismatch during acceptance.");
        }

        const claimed = await claimPendingInvitationForUser({
          email: normalizedEmail,
          executor: tx,
          tokenHash,
          userId,
        });

        if (!claimed) {
          throw new Error("Invitation was not claimable during acceptance.");
        }

        await setUserRole({ executor: tx, role: claimed.role, userId });
      });
    } catch (error) {
      console.error("Invitation acceptance failed after user signup.", {
        error,
        userId,
      });
      await recoverFailedInvitationSignup(userId);

      return {
        message:
          "Your account was created, but the invitation could not be accepted. Contact support before signing in.",
        status: "acceptance-failed",
        statusCode: 500,
      };
    }

    return {
      headers: signup.headers ?? new Headers(),
      redirectTo: getSafeAuthRedirect(callbackURL || "/account"),
      status: "success",
    };
  } catch {
    return {
      message: "Invitation signup failed.",
      status: "signup-failed",
      statusCode: 422,
    };
  }
}
