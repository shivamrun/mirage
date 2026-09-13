import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type * as React from "react";

import AuthContainer from "@/components/auth/auth-container";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { VerifyEmailRequired } from "@/components/auth/verify-email-required";
import {
  type AuthRole,
  getCurrentUser,
  type RequestHeaders,
} from "@/lib/auth/access";

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
  const url = new URL(callbackURL, "http://localhost");

  return url.searchParams.get("verificationEmail") === "sent";
}

function cleanCallbackURL(callbackURL: string) {
  const url = new URL(callbackURL, "http://localhost");
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

  if (!user) {
    redirect(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
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

  if (gateTwoFactor && !user.twoFactorEnabled) {
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

  return children;
}

export { VerifiedRoleGate };
