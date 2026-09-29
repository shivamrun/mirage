"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { AuthStatusMessage } from "@/features/auth/components/auth-form-shell";
import { api } from "@/shared/api/client";
import {
  showCriticalEmailToast,
  showEmailSuccessToast,
} from "@/shared/ui/email-flow-toast";

type VerifyEmailRequiredFormProps = {
  callbackURL: string;
  email: string;
  sent?: boolean;
};

const DEFAULT_VERIFY_EMAIL_COOLDOWN_SECONDS = 60;

function formatCooldown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function VerifyEmailRequiredForm({
  callbackURL,
  email,
  sent = false,
}: VerifyEmailRequiredFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = React.useState(0);
  const [state, setState] = React.useState({
    sent,
  });
  const isSent = sent || state.sent;

  React.useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  async function sendVerificationEmail(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsPending(true);
    setState({ sent: false });

    try {
      const { data, error } = await api.api["auth-actions"][
        "protected-route-verification-email"
      ].post({ callbackURL });

      if (error) {
        const value = error.value as { message?: string } | null;
        showCriticalEmailToast(
          value?.message ||
            "We could not send the verification link. Please try again.",
        );
        return;
      }

      if (data?.redirectURL) {
        router.replace(data.redirectURL, { scroll: false });
      }

      setResendCooldownSeconds(DEFAULT_VERIFY_EMAIL_COOLDOWN_SECONDS);
      setState({ sent: true });
      showEmailSuccessToast(`Verification link sent to ${email}.`);
    } catch {
      showCriticalEmailToast(
        "We could not send the verification link. Please try again.",
      );
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

      <form onSubmit={sendVerificationEmail}>
        <input name="callbackURL" type="hidden" value={callbackURL} />
        <Button
          className="w-full"
          disabled={isPending || resendCooldownSeconds > 0}
          type="submit"
        >
          <MailCheck data-icon="inline-start" />
          {isPending
            ? "Sending..."
            : resendCooldownSeconds > 0
              ? `Resend in ${formatCooldown(resendCooldownSeconds)}`
              : "Send verification link"}
        </Button>
      </form>
    </div>
  );
}

export { VerifyEmailRequiredForm };
