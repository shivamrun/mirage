"use client";

import Link from "next/link";
import * as React from "react";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import { RegisterForm } from "./register-form";

type Validation = {
  email?: string;
  status: string;
  valid: boolean;
};

function InvalidInvitation({ status }: { status: string }) {
  const message =
    status === "expired"
      ? "This invitation has expired."
      : status === "accepted"
        ? "This invitation has already been accepted."
        : status === "revoked"
          ? "This invitation has been revoked."
          : "This invitation is not available.";

  return (
    <section className="w-full max-w-md text-center">
      <div className="mb-6 space-y-2 pt-4 pb-2">
        <h1 className="text-4xl">Invitation unavailable</h1>
        <p className="mt-3 text-muted-foreground text-base">{message}</p>
      </div>
      <Link className="link-text" href="/login">
        Return to sign in
      </Link>
    </section>
  );
}

export function InvitationAcceptContent({
  callbackURL,
  legacyToken,
}: {
  callbackURL?: string;
  legacyToken?: string;
}) {
  const [token, setToken] = React.useState(legacyToken ?? "");
  const [validation, setValidation] = React.useState<Validation>();

  React.useEffect(() => {
    const fragmentToken = new URLSearchParams(
      window.location.hash.slice(1),
    ).get("token");
    const resolvedToken = fragmentToken || legacyToken || "";
    const safeCallbackURL = callbackURL
      ? getSafeAuthRedirect(callbackURL)
      : undefined;
    const cleanUrl = `${window.location.pathname}${
      safeCallbackURL
        ? `?callbackURL=${encodeURIComponent(safeCallbackURL)}`
        : ""
    }`;

    window.history.replaceState(null, "", cleanUrl);
    setToken(resolvedToken);

    if (!resolvedToken) {
      setValidation({ status: "invalid", valid: false });
      return;
    }

    const controller = new AbortController();
    void fetch("/api/invitations/validate", {
      body: JSON.stringify({ token: resolvedToken }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Invitation validation failed.");
        }
        return (await response.json()) as Validation;
      })
      .then(setValidation)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setValidation({ status: "invalid", valid: false });
        }
      });

    return () => controller.abort();
  }, [callbackURL, legacyToken]);

  if (!validation) {
    return <p className="text-muted-foreground">Checking invitation…</p>;
  }

  if (!validation.valid || !validation.email || !token) {
    return <InvalidInvitation status={validation.status} />;
  }

  return (
    <RegisterForm
      redirectTo={getSafeAuthRedirect(callbackURL || "/account")}
      invitedEmail={validation.email}
      invitationToken={token}
    />
  );
}
