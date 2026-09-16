import {
  deleteAdminLinkedAccount,
  getAdminUserSessionForDeletion,
} from "@/server/db/dal/admin-user-detail";
import {
  getSecurityControlSummary,
  getUserForPasswordReset,
  revokeAllSessions,
  revokeUserSessions,
} from "@/server/db/dal/security";
import {
  canDeleteLinkedAccount,
  canDeleteUserSession,
} from "@/server/db/services/auth/admin-access";
import { auth } from "@/server/db/services/auth/better-auth";
import type { CurrentUser } from "@/server/db/services/auth/current-user";
import { env } from "@/shared/env";

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

type UnlinkAdminLinkedAccountResult =
  | {
      status: "not-found";
    }
  | {
      status: "credential";
    }
  | {
      status: "last-method";
    }
  | {
      message: string;
      status: "denied";
      statusCode: 403 | 404;
    }
  | {
      account: Extract<
        Awaited<ReturnType<typeof deleteAdminLinkedAccount>>,
        { status: "deleted" }
      >["account"];
      status: "deleted";
    };

type RevokeAdminUserSessionResult =
  | {
      status: "not-found";
    }
  | {
      message: string;
      status: "denied";
      statusCode: 403 | 404;
    }
  | {
      session: {
        id: string;
        userId: string;
      };
      status: "revoked";
    };

export async function unlinkAdminLinkedAccount({
  accountRowId,
  actor,
  userId,
}: {
  accountRowId: string;
  actor: CurrentUser;
  userId: string;
}): Promise<UnlinkAdminLinkedAccountResult> {
  const actorDecision = canDeleteLinkedAccount({
    actor,
    remainingSignInMethods: 1,
  });

  if (!actorDecision.allowed) {
    return {
      message: actorDecision.message,
      status: "denied",
      statusCode: actorDecision.statusCode,
    };
  }

  const result = await deleteAdminLinkedAccount(userId, accountRowId);

  if (result.status === "not-found" || result.status === "credential") {
    return result;
  }

  const decision = canDeleteLinkedAccount({
    actor,
    remainingSignInMethods: result.remainingSignInMethods,
  });

  if (!decision.allowed) {
    return {
      message: decision.message,
      status: "denied",
      statusCode: decision.statusCode,
    };
  }

  if (result.status === "last-method") {
    return { status: "last-method" };
  }

  return {
    account: result.account,
    status: "deleted",
  };
}

export async function revokeAdminUserSession({
  actor,
  headers,
  sessionId,
  userId,
}: {
  actor: CurrentUser;
  headers: Headers;
  sessionId: string;
  userId: string;
}): Promise<RevokeAdminUserSessionResult> {
  const userSession = await getAdminUserSessionForDeletion(userId, sessionId);

  if (!userSession) {
    return { status: "not-found" };
  }

  const decision = canDeleteUserSession({
    actor,
    targetSessionUserId: userSession.userId,
  });

  if (!decision.allowed) {
    return {
      message: decision.message,
      status: "denied",
      statusCode: decision.statusCode,
    };
  }

  await auth.api.revokeUserSession({
    body: {
      sessionToken: userSession.token,
    },
    headers,
  });

  return {
    session: {
      id: userSession.id,
      userId: userSession.userId,
    },
    status: "revoked",
  };
}

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

export async function getAdminSecurityControlSummaryView() {
  return getSecurityControlSummary();
}
