"use server";

import { headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

const protectedRoutePrefixes = ["/admin", "/creator", "/moderator"];

function isProtectedAccessPath(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function sanitizeProtectedCallbackURL(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  const url = new URL(value, "http://localhost");

  if (!isProtectedAccessPath(url.pathname)) {
    return "/";
  }

  url.searchParams.delete("verificationEmail");

  return `${url.pathname}${url.search}${url.hash}`;
}

function createVerificationSentURL(callbackURL: string) {
  const url = new URL(callbackURL, "http://localhost");
  url.searchParams.set("verificationEmail", "sent");

  return `${url.pathname}${url.search}${url.hash}`;
}

export type ProtectedRouteVerificationState = {
  message?: string;
  sent: boolean;
};

export async function sendProtectedRouteVerificationEmail(
  _state: ProtectedRouteVerificationState,
  formData: FormData,
): Promise<ProtectedRouteVerificationState> {
  const callbackURL = sanitizeProtectedCallbackURL(formData.get("callbackURL"));
  const headers = await requestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    redirect(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }

  if (session.user.emailVerified) {
    redirect(callbackURL);
  }

  try {
    await auth.api.sendVerificationEmail({
      body: {
        callbackURL,
        email: session.user.email,
      },
      headers,
    });
  } catch {
    return {
      message: "We could not send the verification link. Please try again.",
      sent: false,
    };
  }

  return {
    message: createVerificationSentURL(callbackURL),
    sent: true,
  };
}
