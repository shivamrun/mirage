"use client";

import { RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import * as React from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { HeadingBlock } from "@/components/heading-block";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AuthOtpField } from "@/features/auth/components";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { api } from "@/shared/api/client";
import { showEmailSuccessToast } from "@/shared/ui/email-flow-toast";
import { cn } from "@/shared/utils";

type TwoFactorUser = {
  email: string;
  twoFactorEnabled?: boolean | null;
};

type TwoFactorAction = "enable" | "disable";

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

type AccountTwoFactorFormProps = {
  onSessionRefresh: () => Promise<void>;
  user: TwoFactorUser;
};

function readAccountError(error: { value?: unknown } | null) {
  const body = error?.value as {
    message?: string;
  } | null;

  return body?.message || "Something went wrong. Please try again.";
}

function readDeliveryRecovery(error: { value?: unknown } | null) {
  return error?.value as {
    message?: string;
    recovery?: string;
    retryAfterSeconds?: number;
  } | null;
}

function formatCooldown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getRetrySeconds(value?: number) {
  return value && value > 0
    ? Math.ceil(value)
    : DEFAULT_RESEND_COOLDOWN_SECONDS;
}

function isRetryGuidance(message: string) {
  return message.toLowerCase().includes("wait before");
}

function AccountTwoFactorForm({
  onSessionRefresh,
  user,
}: AccountTwoFactorFormProps) {
  const [emailCode, setEmailCode] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [totpURI, setTotpURI] = React.useState<string>();
  const [pendingAction, setPendingAction] = React.useState<TwoFactorAction>();
  const [codeDeliveryUnconfirmed, setCodeDeliveryUnconfirmed] =
    React.useState(false);
  const [emailCodeError, setEmailCodeError] = React.useState<string>();
  const [resendCooldownSeconds, setResendCooldownSeconds] = React.useState(0);
  const [totpCodeError, setTotpCodeError] = React.useState<string>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSendingCode, setIsSendingCode] = React.useState(false);
  const [isContinuing, setIsContinuing] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(
    Boolean(user.twoFactorEnabled),
  );

  React.useEffect(() => {
    setIsEnabled(Boolean(user.twoFactorEnabled));
  }, [user.twoFactorEnabled]);

  React.useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  const hasEmailCode = emailCode.replace(/\D/g, "").length === 6;
  const hasTotpCode = totpCode.replace(/\D/g, "").length === 6;
  const isResendCoolingDown = resendCooldownSeconds > 0;
  const destructiveButtonClassName =
    "border-destructive bg-destructive text-white hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30 dark:text-white";

  async function sendEmailCode(action: TwoFactorAction) {
    setEmailCodeError(undefined);
    setTotpCodeError(undefined);
    setIsSendingCode(true);

    try {
      const { error } = await api.api.account["two-factor"]["send-code"].post({
        action,
      });

      if (error) {
        const body = readDeliveryRecovery(error);
        const message = readAccountError(error);
        if (body?.recovery === "try-delivered-code") {
          setEmailCode("");
          setPendingAction(action);
          setCodeDeliveryUnconfirmed(true);
          setResendCooldownSeconds(getRetrySeconds(body.retryAfterSeconds));
          toast(message);
          return;
        }
        if (isRetryGuidance(message)) {
          setResendCooldownSeconds(getRetrySeconds(body?.retryAfterSeconds));
          toast(message);
          return;
        }
        toast(message);
        return;
      }

      setEmailCode("");
      setPendingAction(action);
      setCodeDeliveryUnconfirmed(false);
      setResendCooldownSeconds(DEFAULT_RESEND_COOLDOWN_SECONDS);
      showEmailSuccessToast(`Code sent to ${user.email}.`);
    } catch (reason) {
      toast(getUnexpectedAuthErrorMessage(reason));
    } finally {
      setIsSendingCode(false);
    }
  }

  async function continueWithEmailCode(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!pendingAction) {
      return;
    }

    if (!hasEmailCode) {
      return;
    }

    setEmailCodeError(undefined);
    setIsContinuing(true);

    try {
      if (pendingAction === "enable") {
        const { data, error } = await api.api.account["two-factor"][
          "start-setup"
        ].post({ code: emailCode });

        if (error) {
          setEmailCodeError(readAccountError(error));
          return;
        }

        setTotpURI((data as { totpURI: string }).totpURI);
        setEmailCode("");
        return;
      }

      const { data, error } = await api.api.account["two-factor"].disable.post({
        code: emailCode,
      });

      if (error) {
        setEmailCodeError(readAccountError(error));
        return;
      }

      setEmailCode("");
      setPendingAction(undefined);
      setDialogOpen(false);
      setIsEnabled(
        Boolean((data as { twoFactorEnabled: boolean }).twoFactorEnabled),
      );
      await onSessionRefresh();
      setEmailCodeError(undefined);
    } catch (reason) {
      setEmailCodeError(getUnexpectedAuthErrorMessage(reason));
    } finally {
      setIsContinuing(false);
    }
  }

  async function verifySetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasTotpCode) {
      return;
    }

    setTotpCodeError(undefined);
    setIsVerifying(true);

    try {
      const { data, error } = await api.api.account["two-factor"][
        "verify-setup"
      ].post({ code: totpCode });

      if (error) {
        setTotpCodeError(readAccountError(error));
        return;
      }

      setTotpCode("");
      setTotpURI(undefined);
      setPendingAction(undefined);
      setDialogOpen(false);
      setIsEnabled(
        Boolean((data as { twoFactorEnabled: boolean }).twoFactorEnabled),
      );
      await onSessionRefresh();
      setTotpCodeError(undefined);
    } catch (reason) {
      setTotpCodeError(getUnexpectedAuthErrorMessage(reason));
    } finally {
      setIsVerifying(false);
    }
  }

  const dialogTitle = totpURI
    ? "Scan QR code"
    : pendingAction
      ? "Enter email code"
      : isEnabled
        ? "Disable authenticator app?"
        : "Enable authenticator app?";
  const dialogDescription = totpURI
    ? "Scan this QR code with your authenticator app, then enter the 6-digit code it shows."
    : pendingAction
      ? codeDeliveryUnconfirmed
        ? `Delivery could not be confirmed. If a code arrived at ${user.email}, enter it here. Otherwise, request another code after a minute.`
        : `Enter the 6-digit code sent to ${user.email}.`
      : isEnabled
        ? `We will send a 6-digit code to ${user.email}. Enter it here to remove authenticator app sign-in from your account.`
        : `We will send a 6-digit code to ${user.email}. Enter it here before scanning a QR code with your authenticator app.`;

  return (
    <div className="flex flex-col gap-4">
      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (open) {
            setEmailCodeError(undefined);
            setTotpCodeError(undefined);
          }

          if (!open && !isSendingCode && !isContinuing && !isVerifying) {
            setPendingAction(undefined);
            setCodeDeliveryUnconfirmed(false);
            setEmailCode("");
            setTotpCode("");
            setTotpURI(undefined);
            setEmailCodeError(undefined);
            setResendCooldownSeconds(0);
            setTotpCodeError(undefined);
          }
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <HeadingBlock
            className="min-w-0"
            description={
              isEnabled
                ? "Authenticator codes are required after password sign-in."
                : "Password sign-in does not require an authenticator code."
            }
            size="sm"
            title={isEnabled ? "Enabled" : "Disabled"}
            titleAs="h3"
          />

          <AlertDialogTrigger asChild>
            <button
              aria-label={
                isEnabled
                  ? "Disable authenticator app sign-in"
                  : "Enable authenticator app sign-in"
              }
              aria-checked={isEnabled}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                isEnabled
                  ? "border-primary bg-primary"
                  : "border-input bg-muted",
              )}
              disabled={isSendingCode || isContinuing}
              role="switch"
              type="button"
            >
              <span
                className={cn(
                  "block size-5 rounded-full bg-background shadow-sm transition-transform",
                  isEnabled ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </AlertDialogTrigger>
        </div>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>

          {totpURI ? (
            <form className="flex flex-col gap-5" onSubmit={verifySetup}>
              <div className="grid place-items-center">
                <div className="grid size-56 place-items-center rounded-lg border bg-white p-4">
                  <QRCode value={totpURI} size={192} />
                </div>
              </div>

              <FieldGroup>
                <AuthOtpField
                  id="setup-totp-code"
                  error={totpCodeError}
                  label="Authenticator code"
                  onChange={(value) => {
                    setTotpCode(value);
                    setTotpCodeError(undefined);
                  }}
                  required
                  value={totpCode}
                />
              </FieldGroup>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isVerifying}>
                  Cancel
                </AlertDialogCancel>
                <Button disabled={isVerifying || !hasTotpCode} type="submit">
                  <ShieldCheck data-icon="inline-start" />
                  {isVerifying ? "Verifying..." : "Finish setup"}
                </Button>
              </AlertDialogFooter>
            </form>
          ) : pendingAction ? (
            <form
              className="flex flex-col gap-5"
              onSubmit={continueWithEmailCode}
            >
              <FieldGroup>
                <AuthOtpField
                  id="two-factor-email-code"
                  error={emailCodeError}
                  label="Email code"
                  onChange={(value) => {
                    setEmailCode(value);
                    setEmailCodeError(undefined);
                  }}
                  required
                  value={emailCode}
                />
              </FieldGroup>
              <AlertDialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch sm:justify-start">
                <p className="text-muted-foreground text-sm">
                  {isResendCoolingDown
                    ? `You can request another code in ${formatCooldown(
                        resendCooldownSeconds,
                      )}.`
                    : "You can request another code now."}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <AlertDialogCancel className="w-full" disabled={isContinuing}>
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    className="w-full"
                    disabled={
                      isContinuing || isSendingCode || isResendCoolingDown
                    }
                    onClick={() => sendEmailCode(pendingAction)}
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw data-icon="inline-start" />
                    {isSendingCode ? "Sending..." : "Resend code"}
                  </Button>
                  <Button
                    className={cn(
                      "w-full sm:col-span-2",
                      pendingAction === "disable"
                        ? destructiveButtonClassName
                        : undefined,
                    )}
                    disabled={isContinuing || isSendingCode || !hasEmailCode}
                    type="submit"
                    variant={
                      pendingAction === "disable" ? "destructive" : "default"
                    }
                  >
                    {pendingAction === "disable" ? (
                      <ShieldOff data-icon="inline-start" />
                    ) : (
                      <ShieldCheck data-icon="inline-start" />
                    )}
                    {isContinuing
                      ? "Checking..."
                      : pendingAction === "disable"
                        ? "Disable authenticator"
                        : "Continue setup"}
                  </Button>
                </div>
              </AlertDialogFooter>
            </form>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSendingCode}>
                Cancel
              </AlertDialogCancel>
              <Button
                className={isEnabled ? destructiveButtonClassName : undefined}
                disabled={isSendingCode}
                onClick={() => sendEmailCode(isEnabled ? "disable" : "enable")}
                type="button"
                variant={isEnabled ? "destructive" : "default"}
              >
                {isEnabled ? (
                  <ShieldOff data-icon="inline-start" />
                ) : (
                  <ShieldCheck data-icon="inline-start" />
                )}
                {isSendingCode ? "Sending..." : "Send code"}
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { AccountTwoFactorForm };
