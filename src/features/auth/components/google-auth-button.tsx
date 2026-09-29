"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/better-auth/client";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { AuthStatusMessage } from "@/features/auth/components/auth-form-shell";

type GoogleAuthButtonProps = {
  redirectTo: string;
  disabled?: boolean;
  onBeforeSignIn?: () => boolean | Promise<boolean>;
  referralCode?: string;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.51z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.41 13.9A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.08 4.49l3.33-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 3.01 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.51l3.33 2.59C7.2 7.74 9.4 5.98 12 5.98z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleAuthButton({
  redirectTo,
  disabled = false,
  onBeforeSignIn,
  referralCode,
}: GoogleAuthButtonProps) {
  const [error, setError] = React.useState<string>();
  const [isPending, setIsPending] = React.useState(false);

  async function signInWithGoogle() {
    setError(undefined);

    try {
      const canContinue = await onBeforeSignIn?.();

      if (canContinue === false) {
        return;
      }

      setIsPending(true);

      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
        ...(referralCode
          ? {
              requestSignUp: true,
              additionalData: {
                "x-referral-code": referralCode,
              },
            }
          : {}),
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        setIsPending(false);
        return;
      }

      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
      ) : null}
      <Button
        className="w-full"
        disabled={disabled || isPending}
        onClick={signInWithGoogle}
        type="button"
        variant="outline"
      >
        <GoogleIcon />
        {isPending ? "Redirecting..." : "Continue with Google"}
      </Button>
    </div>
  );
}

function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-xs">
      <div className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export { AuthDivider, GoogleAuthButton, GoogleIcon };
