"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AuthStatusMessage } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";

type VerifyEmailRequiredFormProps = {
  callbackURL: string;
  email: string;
  sent?: boolean;
};

type VerificationResponse = {
  message?: string;
  redirectURL?: string;
  status?: boolean;
};

function VerifyEmailRequiredForm({
  callbackURL,
  email,
  sent = false,
}: VerifyEmailRequiredFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [state, setState] = React.useState({
    message: "",
    sent,
  });
  const isSent = sent || state.sent;

  async function sendVerificationEmail(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsPending(true);
    setState({ message: "", sent: false });

    try {
      const response = await fetch(
        "/api/auth-actions/protected-route-verification-email",
        {
          body: JSON.stringify({ callbackURL }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const result = (await response.json().catch(() => ({}))) as
        | VerificationResponse
        | undefined;

      if (!response.ok) {
        setState({
          message:
            result?.message ||
            "We could not send the verification link. Please try again.",
          sent: false,
        });
        return;
      }

      if (result?.redirectURL) {
        router.replace(result.redirectURL, { scroll: false });
      }

      setState({ message: "", sent: true });
    } catch {
      setState({
        message: "We could not send the verification link. Please try again.",
        sent: false,
      });
    } finally {
      setIsPending(false);
    }
  }

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

      <form onSubmit={sendVerificationEmail}>
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
