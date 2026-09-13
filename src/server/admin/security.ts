import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  getUserForPasswordReset,
  revokeAllSessions,
  revokeUserSessions,
} from "@/server/db/dal/security";

type ForcePasswordResetResult =
  | {
      status: "not-found";
    }
  | {
      resetEmailDelivery: "unconfirmed";
      revokedSessions: number;
      status: "partial-failure";
      targetEmail: string;
    }
  | {
      resetEmailDelivery: "unconfirmed";
      revokedSessions: number;
      status: "success";
      targetEmail: string;
      user: NonNullable<Awaited<ReturnType<typeof getUserForPasswordReset>>>;
    };

export async function forcePasswordReset({
  email,
  headers,
}: {
  email: string;
  headers: Headers;
}): Promise<ForcePasswordResetResult> {
  const targetUser = await getUserForPasswordReset(email);

  if (!targetUser) {
    return { status: "not-found" };
  }

  const revokedSessions = await revokeUserSessions(targetUser.id);
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: targetUser.email,
        redirectTo: `${env.NEXT_PUBLIC_BASE_URL}/reset-password`,
      },
      headers,
    });
  } catch {
    console.error("Admin password-reset request failed after revocation.");
    return {
      resetEmailDelivery: "unconfirmed",
      revokedSessions: revokedSessions.length,
      status: "partial-failure",
      targetEmail: targetUser.email,
    };
  }

  return {
    resetEmailDelivery: "unconfirmed",
    revokedSessions: revokedSessions.length,
    status: "success",
    targetEmail: targetUser.email,
    user: targetUser,
  };
}

export async function revokeEverySession() {
  const revokedSessions = await revokeAllSessions();

  return {
    revokedSessions: revokedSessions.length,
    status: true as const,
  };
}
