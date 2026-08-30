"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type InviteActivationProps = {
  callbackURL: string;
  token: string;
};

export function InviteActivation({
  callbackURL,
  token,
}: InviteActivationProps) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let isMounted = true;

    async function activateInvite() {
      try {
        const result = await authClient.invite.activate({
          callbackURL,
          token,
        });

        if (!isMounted) {
          return;
        }

        if (result.error) {
          setError(getAuthErrorMessage(result.error));
          return;
        }

        const redirectTo = result.data?.redirectTo ?? callbackURL;

        router.replace(redirectTo);
        router.refresh();
      } catch (reason) {
        if (isMounted) {
          setError(getUnexpectedAuthErrorMessage(reason));
        }
      }
    }

    void activateInvite();

    return () => {
      isMounted = false;
    };
  }, [callbackURL, router, token]);

  return (
    <AuthFormShell
      title="Opening your invite"
      description="We are checking this Mirage workspace invite."
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="link-text"
            href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
        ) : (
          <AuthStatusMessage tone="success">
            Preparing your access...
          </AuthStatusMessage>
        )}
        {error ? (
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        ) : null}
      </div>
    </AuthFormShell>
  );
}
