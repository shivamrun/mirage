import { createHmac, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  authRoles,
  normalizeRoles,
  type RoleValue,
} from "@/features/auth/roles";
import db from "@/server/db";
import { getAuthUserByEmail } from "@/server/db/dal/auth";
import {
  createInvitationRecord,
  findActivePendingInvitationByEmail,
  type InvitationRecord,
} from "@/server/db/dal/invitations";
import { env } from "@/shared/env";
import { emailSchema } from "@/shared/schemas/helpers/email";

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
