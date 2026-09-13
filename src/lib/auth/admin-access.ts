import type { CurrentUser } from "@/lib/auth/current-user";
import { hasAdminSessionAssurance } from "@/server/db/dal/admin-session-assurance";

export const adminAccessMessages = {
  emailVerificationRequired: "Email verification required",
  notFound: "Not Found",
  twoFactorRequired: "Two-factor authentication required",
} as const;

type AdminAccessDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      message: string;
      reason:
        | "email-verification-required"
        | "not-found"
        | "two-factor-required";
      statusCode: 403 | 404;
    };

export async function evaluateAdminAccess(
  user: CurrentUser | null,
): Promise<AdminAccessDecision> {
  if (!user?.roles.includes("admin")) {
    return {
      allowed: false,
      message: adminAccessMessages.notFound,
      reason: "not-found",
      statusCode: 404,
    };
  }

  if (!user.emailVerified) {
    return {
      allowed: false,
      message: adminAccessMessages.emailVerificationRequired,
      reason: "email-verification-required",
      statusCode: 403,
    };
  }

  if (
    !user.twoFactorEnabled ||
    !(await hasAdminSessionAssurance({
      sessionId: user.session.id,
      userId: user.id,
    }))
  ) {
    return {
      allowed: false,
      message: adminAccessMessages.twoFactorRequired,
      reason: "two-factor-required",
      statusCode: 403,
    };
  }

  return { allowed: true };
}
