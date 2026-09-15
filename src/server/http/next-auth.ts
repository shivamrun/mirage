import {
  type AuthPolicyDecision,
  type AuthPolicyReason,
  evaluateAdminAccess,
} from "@/server/auth/admin-access";
import { getCurrentUser } from "@/server/auth/current-user";

type NextAuthDenialOptions = {
  reasons?: AuthPolicyReason[];
};

export function authPolicyDecisionToNextResponse(
  decision: AuthPolicyDecision,
  options: NextAuthDenialOptions = {},
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

export async function resolveNextAdminAccess(request: Request) {
  const user = await getCurrentUser({
    headers: request.headers,
    sessionCookieCache: "bypass",
  });
  const decision = await evaluateAdminAccess(user);

  return {
    decision,
    user,
  };
}
