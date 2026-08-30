"use client";

import Link from "next/link";
import * as React from "react";

import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/metadata";

type EmailChangeAction = "approve" | "confirm";

function getActionCopy(action: EmailChangeAction) {
  if (action === "approve") {
    return {
      button: "Approve email change",
      description: `If you asked to change your ${siteConfig.name} email, approve it here.`,
      title: "Approve this email change",
    };
  }

  return {
    button: "Confirm new email",
    description:
      "One last step: confirm this address and we'll finish the change.",
    title: "Confirm your new email",
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
      setError("That email change link is invalid or expired.");
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
        setError(result.message || "That email change link could not be used.");
        return;
      }

      if (!result.redirectURL) {
        setError("We could not complete that email change link.");
        return;
      }

      const redirectURL = new URL(result.redirectURL, window.location.origin);

      if (redirectURL.origin !== window.location.origin) {
        setError("We could not complete that email change link.");
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
        <Link className="link-text" href={siteConfig.links.home}>
          Back to {siteConfig.name}
        </Link>
      }
      title={copy.title}
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {status || !token ? (
          <AuthStatusMessage tone="error">
            That email change link is invalid or expired.
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
