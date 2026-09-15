import type { AuthSession } from "@/server/auth/current-user";
import { getGoogleAccountByUserId } from "@/server/db/dal/google-account";

type GoogleIdTokenPayload = {
  email?: unknown;
};

function decodeGoogleEmail(idToken: string | null) {
  if (!idToken) {
    return null;
  }

  try {
    const payload = idToken.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const parsed = JSON.parse(
      Buffer.from(paddedPayload, "base64").toString("utf8"),
    ) as GoogleIdTokenPayload;

    return typeof parsed.email === "string" ? parsed.email : null;
  } catch {
    return null;
  }
}

async function getConnectedGoogleAccount({
  authSession,
}: {
  authSession: AuthSession;
}) {
  const connectedAccount = await getGoogleAccountByUserId(authSession.user.id);

  if (!connectedAccount) {
    return null;
  }

  return {
    accountId: connectedAccount.accountId,
    createdAt: connectedAccount.createdAt.toISOString(),
    email: decodeGoogleEmail(connectedAccount.idToken),
    providerId: "google" as const,
  };
}

export { getConnectedGoogleAccount };
