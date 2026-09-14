import type { CurrentUser } from "@/lib/auth/current-user";
import { hasAdminSessionAssurance } from "@/server/db/dal/admin-session-assurance";

export const adminAccessMessages = {
  emailVerificationRequired: "Email verification required",
  notFound: "Not Found",
  twoFactorRequired: "Two-factor authentication required",
} as const;

type AuthPolicyReason =
  | "email-verification-required"
  | "not-found"
  | "two-factor-required";

export type AuthPolicyDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      message: string;
      reason: AuthPolicyReason;
      statusCode: 403 | 404;
    };

export function evaluateAdminRole(
  user: CurrentUser | null,
): AuthPolicyDecision {
  if (!user?.roles.includes("admin")) {
    return {
      allowed: false,
      message: adminAccessMessages.notFound,
      reason: "not-found",
      statusCode: 404,
    };
  }

  return { allowed: true };
}

export function evaluateVerifiedEmail(
  user: CurrentUser | null,
): AuthPolicyDecision {
  if (!user) {
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

  return { allowed: true };
}

export function evaluateTwoFactorEnabled(
  user: CurrentUser | null,
): AuthPolicyDecision {
  if (!user) {
    return {
      allowed: false,
      message: adminAccessMessages.notFound,
      reason: "not-found",
      statusCode: 404,
    };
  }

  if (!user.twoFactorEnabled) {
    return {
      allowed: false,
      message: adminAccessMessages.twoFactorRequired,
      reason: "two-factor-required",
      statusCode: 403,
    };
  }

  return { allowed: true };
}

export async function evaluateAdminSessionAssurance(
  user: CurrentUser | null,
): Promise<AuthPolicyDecision> {
  if (!user) {
    return {
      allowed: false,
      message: adminAccessMessages.notFound,
      reason: "not-found",
      statusCode: 404,
    };
  }

  const hasAssurance = await hasAdminSessionAssurance({
    sessionId: user.session.id,
    userId: user.id,
  });

  if (!hasAssurance) {
    return {
      allowed: false,
      message: adminAccessMessages.twoFactorRequired,
      reason: "two-factor-required",
      statusCode: 403,
    };
  }

  return { allowed: true };
}

export async function evaluateAdminAccess(
  user: CurrentUser | null,
): Promise<AuthPolicyDecision> {
  const decisions = [
    evaluateAdminRole(user),
    evaluateVerifiedEmail(user),
    evaluateTwoFactorEnabled(user),
  ];

  for (const decision of decisions) {
    if (!decision.allowed) {
      return decision;
    }
  }

  return evaluateAdminSessionAssurance(user);
}
