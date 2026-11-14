import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type * as React from "react";

import AuthContainer from "@/features/auth/components/auth-container";
import { AuthFormShell } from "@/features/auth/components/auth-form-shell";
import { TwoFactorForm } from "@/features/auth/components/two-factor-form";
import { VerifyEmailRequired } from "@/features/auth/components/verify-email-required";
import {
  getLoginRedirectPath,
  getSafeAuthRedirect,
} from "@/features/auth/redirect";
import {
  type AuthRole,
  getCurrentUser,
  type RequestHeaders,
} from "@/server/db/services/auth/access";
import {
  evaluateAdminAccess,
  isAdminSessionAssuranceRequired,
} from "@/server/db/services/auth/admin-access";

const fallbackCallbackURLByRole: Record<AuthRole, string> = {
  admin: "/admin",
  user: "/account",
};

function getRequestedPath(headers: RequestHeaders, role: AuthRole) {
  return (
    headers.get("x-mirage-current-path") ?? fallbackCallbackURLByRole[role]
  );
}

function isVerificationSent(callbackURL: string) {
  const url = new URL(getSafeAuthRedirect(callbackURL), "http://localhost");

  return url.searchParams.get("verificationEmail") === "sent";
}

function cleanCallbackURL(callbackURL: string) {
  const url = new URL(getSafeAuthRedirect(callbackURL), "http://localhost");
  url.searchParams.delete("verificationEmail");

  return `${url.pathname}${url.search}${url.hash}`;
}

async function VerifiedRoleGate({
  children,
  gateTwoFactor = false,
  gateUnverifiedUsers = true,
  requiredRole,
}: {
  children: React.ReactNode;
  gateTwoFactor?: boolean;
  gateUnverifiedUsers?: boolean;
  requiredRole: AuthRole;
}) {
  const headers = await requestHeaders();
  const requestedPath = getRequestedPath(headers, requiredRole);
  const callbackURL = cleanCallbackURL(requestedPath);
  const user = await getCurrentUser({ headers });
  const requireAdminSessionAssurance = isAdminSessionAssuranceRequired();

  if (!user) {
    redirect(getLoginRedirectPath(callbackURL));
  }

  if (!user.roles.includes(requiredRole)) {
    notFound();
  }

  if (gateUnverifiedUsers && !user.emailVerified) {
    return (
      <AuthContainer
        authForm={
          <VerifyEmailRequired
            callbackURL={callbackURL}
            email={user.email}
            sent={isVerificationSent(requestedPath)}
          />
        }
      />
    );
  }

  if (
    gateTwoFactor &&
    requireAdminSessionAssurance &&
    !user.twoFactorEnabled
  ) {
    return (
      <AuthContainer
        authForm={
          <AuthFormShell
            title="Enable two-factor"
            description="Admin access requires two-factor authentication. Enable it on your account before returning here."
            footer={
              <a className="link-text" href="/account/security">
                Open account security
              </a>
            }
          >
            <a
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
              href="/account/security"
            >
              Enable two-factor authentication
            </a>
          </AuthFormShell>
        }
      />
    );
  }

  if (gateTwoFactor && requiredRole === "admin") {
    const decision = await evaluateAdminAccess(user);

    if (!decision.allowed) {
      return (
        <AuthContainer
          authForm={
            <TwoFactorForm mode="admin-step-up" redirectTo={callbackURL} />
          }
        />
      );
    }
  }

  return children;
}

export { VerifiedRoleGate };
