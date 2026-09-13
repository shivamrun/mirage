"use client";

import Link from "next/link";
import * as React from "react";

import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
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
  const [needsAccountRecovery, setNeedsAccountRecovery] = React.useState(false);
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
      const result =
        action === "approve"
          ? await api.api.account["approve-email-change"].post({ token })
          : await api.api.account["confirm-email-change"].post({ token });

      if (result.error) {
        const value = result.error.value as {
          message?: string;
          recovery?: string;
        } | null;
        setError(value?.message || "That email change link could not be used.");
        setNeedsAccountRecovery(value?.recovery === "resend-from-account");
        return;
      }

      if (!result.data?.redirectURL) {
        setError("We could not complete that email change link.");
        return;
      }

      const redirectURL = new URL(
        result.data.redirectURL,
        window.location.origin,
      );

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
        {needsAccountRecovery ? (
          <Link className="link-text" href="/account">
            Go to account settings
          </Link>
        ) : null}
        <Button
          disabled={isSubmitting || !canSubmit || needsAccountRecovery}
          type="submit"
        >
          {isSubmitting ? "Processing..." : copy.button}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { EmailChangeConfirmation };
