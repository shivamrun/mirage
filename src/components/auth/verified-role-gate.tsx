import { headers as requestHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type * as React from "react";

import AuthContainer from "@/components/auth/auth-container";
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
  requiredRole,
}: {
  children: React.ReactNode;
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

  if (!user.emailVerified) {
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

  return children;
}

export { VerifiedRoleGate };
