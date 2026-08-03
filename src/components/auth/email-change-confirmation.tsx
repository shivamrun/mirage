"use client";

import Link from "next/link";
import * as React from "react";

import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";

type EmailChangeAction = "approve" | "confirm";

function getActionCopy(action: EmailChangeAction) {
  if (action === "approve") {
    return {
      button: "Approve email change",
      description:
        "Confirm that you want to change the email address on your Grove account.",
      title: "Approve email change",
    };
  }

  return {
    button: "Confirm new email",
    description:
      "Confirm this email address to finish changing the email on your Grove account.",
    title: "Confirm new email",
  };
}

function EmailChangeConfirmation({
  action,
  status,
  token,
}: {
  action: EmailChangeAction;
  status?: string;
  token?: string;
}) {
  const [error, setError] = React.useState<string>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const copy = getActionCopy(action);
  const canSubmit = Boolean(token && !status);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!canSubmit || !token) {
      setError("This email change link is invalid or expired.");
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint =
        action === "approve"
          ? "/api/account/approve-email-change"
          : "/api/account/confirm-email-change";
      const response = await fetch(endpoint, {
        body: JSON.stringify({ token }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as {
        message?: string;
        redirectURL?: string;
      };

      if (!response.ok) {
        setError(result.message || "This email change link could not be used.");
        return;
      }

      if (!result.redirectURL) {
        setError("This email change link could not be completed.");
        return;
      }

      const redirectURL = new URL(result.redirectURL, window.location.origin);

      if (redirectURL.origin !== window.location.origin) {
        setError("This email change link could not be completed.");
        return;
      }

      window.location.assign(redirectURL.href);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormShell
      description={copy.description}
      footer={
        <Link className="font-medium text-primary" href="/">
          Back to Grove
        </Link>
      }
      title={copy.title}
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {status || !token ? (
          <AuthStatusMessage tone="error">
            This email change link is invalid or expired.
          </AuthStatusMessage>
        ) : null}
        {error ? (
          <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
        ) : null}
        <Button disabled={isSubmitting || !canSubmit} type="submit">
          {isSubmitting ? "Processing..." : copy.button}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { EmailChangeConfirmation };
