"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import {
  type ProtectedRouteVerificationState,
  sendProtectedRouteVerificationEmail,
} from "@/lib/auth/email-verification-actions";

type VerifyEmailRequiredFormProps = {
  callbackURL: string;
  email: string;
  sent?: boolean;
};

const initialState: ProtectedRouteVerificationState = {
  sent: false,
};

function VerifyEmailRequiredForm({
  callbackURL,
  email,
  sent = false,
}: VerifyEmailRequiredFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    sendProtectedRouteVerificationEmail,
    sent ? { sent: true } : initialState,
  );
  const isSent = sent || state.sent;

  React.useEffect(() => {
    if (!state.sent || !state.message) {
      return;
    }

    router.replace(state.message, { scroll: false });
  }, [router, state.message, state.sent]);

  return (
    <div className="flex flex-col gap-4">
      <AuthStatusMessage tone={isSent ? "success" : "info"}>
        {isSent
          ? `Verification link sent to ${email}.`
          : `We need to verify ${email} before opening this area.`}
      </AuthStatusMessage>

      {!state.sent && state.message ? (
        <AuthStatusMessage tone="error">{state.message}</AuthStatusMessage>
      ) : null}

      <form action={formAction}>
        <input name="callbackURL" type="hidden" value={callbackURL} />
        <Button className="w-full" disabled={isPending} type="submit">
          <MailCheck data-icon="inline-start" />
          {isPending ? "Sending..." : "Send verification link"}
        </Button>
      </form>
    </div>
  );
}

export { VerifyEmailRequiredForm };
