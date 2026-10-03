import { auth } from "@/features/auth/better-auth/server";
import {
  type AuthPolicyDecision,
  type AuthPolicyReason,
  evaluateAdminAccess,
} from "@/server/db/services/auth/admin-access";
import { getCurrentUser } from "@/server/db/services/auth/current-user";

type AuthDenialOptions = {
  reasons?: AuthPolicyReason[];
};

export function authPolicyDecisionToResponse(
  decision: AuthPolicyDecision,
  options: AuthDenialOptions = {},
) {
  if (decision.allowed) {
    return null;
  }

  if (options.reasons && !options.reasons.includes(decision.reason)) {
    return null;
  }

  return Response.json(
    { message: decision.message },
    { status: decision.statusCode },
  );
}

export async function resolveAdminAccess(request: Request) {
  const user = await getCurrentUser({
    headers: request.headers,
    sessionCookieCache: "bypass",
  });
  const decision = await evaluateAdminAccess(user);

  return { decision, user };
}

export async function handleBetterAuthRequest(request: Request) {
  if (new URL(request.url).pathname.startsWith("/api/auth/admin/")) {
    const { decision } = await resolveAdminAccess(request);
    const denialResponse = authPolicyDecisionToResponse(decision, {
      reasons: ["email-verification-required", "two-factor-required"],
    });

    if (denialResponse) {
      return denialResponse;
    }
  }

  return auth.handler(request);
}
