"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { AuthStatusMessage } from "@/features/auth/components/auth-form-shell";
import { api } from "@/shared/api/client";

type VerifyEmailRequiredFormProps = {
  callbackURL: string;
  email: string;
  sent?: boolean;
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
      const { data, error } = await api.api["auth-actions"][
        "protected-route-verification-email"
      ].post({ callbackURL });

      if (error) {
        const value = error.value as { message?: string } | null;
        setState({
          message:
            value?.message ||
            "We could not send the verification link. Please try again.",
          sent: false,
        });
        return;
      }

      if (data?.redirectURL) {
        router.replace(data.redirectURL, { scroll: false });
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
