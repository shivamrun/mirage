"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, RefreshCw } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { api } from "@/shared/api/client";
import {
  type ChangeEmailInput,
  type ChangeEmailValues,
  changeEmailSchema,
} from "@/shared/schemas";
import {
  showCriticalEmailToast,
  showEmailInfoToast,
  showEmailSuccessToast,
} from "@/shared/ui/email-flow-toast";

type EmailManagerUser = {
  email: string;
  emailVerified: boolean;
};

type AccountEmailResponse = {
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingEmailStep: "approve-current" | "verify-new" | null;
  pendingEmailExpiresAt: string | null;
};

function readAccountError(error: { value?: unknown } | null) {
  const body = error?.value as {
    message?: string;
  } | null;

  return body?.message || "Something went wrong. Please try again.";
}

const DEFAULT_EMAIL_RESEND_COOLDOWN_SECONDS = 60;

function formatCooldown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function isRetryGuidance(message: string) {
  return message.toLowerCase().includes("wait before");
}

function AccountEmailManager({
  emailChangeStatus,
  onSessionRefresh,
  user,
}: {
  emailChangeStatus?: string;
  onSessionRefresh: () => Promise<void>;
  user: EmailManagerUser;
}) {
  const [emailState, setEmailState] = React.useState<AccountEmailResponse>({
    email: user.email,
    emailVerified: user.emailVerified,
    pendingEmail: null,
    pendingEmailStep: null,
    pendingEmailExpiresAt: null,
  });
  const [resendCooldownSeconds, setResendCooldownSeconds] = React.useState(0);
  const [isSendingVerification, setIsSendingVerification] =
    React.useState(false);
  const handledEmailChangeStatusRef = React.useRef<string | undefined>(
    undefined,
  );
  const form = useForm<ChangeEmailInput, undefined, ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: user.email,
    },
  });

  React.useEffect(() => {
    if (
      !emailChangeStatus ||
      handledEmailChangeStatusRef.current === emailChangeStatus
    ) {
      return;
    }

    handledEmailChangeStatusRef.current = emailChangeStatus;

    if (emailChangeStatus === "success") {
      onSessionRefresh().catch(() => undefined);
      showEmailSuccessToast("Email address updated.");
      return;
    }

    if (emailChangeStatus === "pending") {
      showEmailSuccessToast(
        "Current email approved. Check the new email to finish the change.",
      );
      return;
    }

    if (emailChangeStatus === "expired") {
      showCriticalEmailToast(
        "That email change link expired. Start a new change below.",
      );
      return;
    }

    if (emailChangeStatus === "invalid") {
      showCriticalEmailToast(
        "That email change link is invalid. Start a new change below.",
      );
    }
  }, [emailChangeStatus, onSessionRefresh]);

  React.useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  React.useEffect(() => {
    setEmailState((current) => ({
      ...current,
      email: user.email,
      emailVerified: user.emailVerified,
    }));
    form.reset({
      newEmail: user.email,
    });
  }, [form, user.email, user.emailVerified]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadEmailState() {
      const { data, error } = await api.api.account.get();

      if (error) {
        return;
      }

      if (isMounted) {
        const accountEmailState = data as AccountEmailResponse;

        setEmailState(accountEmailState);
        form.reset({
          newEmail:
            accountEmailState.pendingEmailStep === "verify-new"
              ? (accountEmailState.pendingEmail ?? accountEmailState.email)
              : accountEmailState.email,
        });
      }
    }

    loadEmailState().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [form]);

  async function sendVerificationEmail() {
    const isPendingNewEmailVerification =
      emailState.pendingEmailStep === "verify-new" && emailState.pendingEmail;

    if (emailState.emailVerified && !isPendingNewEmailVerification) {
      return;
    }

    setIsSendingVerification(true);

    try {
      const { data, error } = isPendingNewEmailVerification
        ? await api.api.account["resend-email-change-verification"].post()
        : await api.api.account["resend-verification"].post();

      if (error) {
        const message = readAccountError(error);
        if (isRetryGuidance(message)) {
          setResendCooldownSeconds(DEFAULT_EMAIL_RESEND_COOLDOWN_SECONDS);
          showEmailInfoToast(message);
        } else {
          showCriticalEmailToast(message);
        }
        const state = await api.api.account.get().catch(() => null);
        if (state?.data) setEmailState(state.data as AccountEmailResponse);
        return;
      }

      setEmailState(data as AccountEmailResponse);
      setResendCooldownSeconds(DEFAULT_EMAIL_RESEND_COOLDOWN_SECONDS);
      showEmailSuccessToast(
        `Verification link has been sent to ${
          isPendingNewEmailVerification
            ? emailState.pendingEmail
            : emailState.email
        }.`,
      );
    } catch (reason) {
      showCriticalEmailToast(getUnexpectedAuthErrorMessage(reason));
    } finally {
      setIsSendingVerification(false);
    }
  }

  async function onSubmit(values: ChangeEmailValues) {
    if (values.newEmail === emailState.email) {
      form.setError("newEmail", {
        message: "New email must be different from your current email.",
      });
      return;
    }

    try {
      const { data, error } = await api.api.account["change-email"].post({
        newEmail: values.newEmail,
      });

      if (error) {
        showCriticalEmailToast(readAccountError(error));
        const state = await api.api.account.get().catch(() => null);
        if (state?.data) setEmailState(state.data as AccountEmailResponse);
        return;
      }

      setEmailState(data as AccountEmailResponse);
      await onSessionRefresh();
      form.reset({
        newEmail:
          (data as AccountEmailResponse).pendingEmailStep === "verify-new"
            ? ((data as AccountEmailResponse).pendingEmail ??
              (data as AccountEmailResponse).email)
            : (data as AccountEmailResponse).email,
      });
      setResendCooldownSeconds(DEFAULT_EMAIL_RESEND_COOLDOWN_SECONDS);
      showEmailSuccessToast(
        (data as AccountEmailResponse).pendingEmailStep === "approve-current"
          ? "Approve the request sent to your current email to change email."
          : `Verification link has been sent to ${values.newEmail}.`,
      );
    } catch (reason) {
      showCriticalEmailToast(getUnexpectedAuthErrorMessage(reason));
    }
  }

  const enteredEmail = form.watch("newEmail");
  const displayedEmail =
    emailState.pendingEmailStep === "verify-new"
      ? (emailState.pendingEmail ?? emailState.email)
      : emailState.email;
  const displayedEmailVerified =
    emailState.pendingEmailStep !== "verify-new" && emailState.emailVerified;
  const hasEmailChange = enteredEmail !== displayedEmail;
  const error = form.formState.errors.newEmail?.message;
  const emailTone = error
    ? "error"
    : displayedEmailVerified
      ? "verified"
      : emailState.pendingEmailStep === "approve-current"
        ? "pending"
        : "needs-verification";
  const note = emailState.pendingEmail
    ? emailState.pendingEmailStep === "approve-current"
      ? `Email change to ${emailState.pendingEmail} is pending approval from your current email.`
      : `Email change to ${emailState.pendingEmail} is pending verification. You can resend if the message does not arrive.`
    : null;
  const noteClassName =
    emailTone === "verified"
      ? "text-emerald-700 dark:text-emerald-300"
      : emailTone === "pending"
        ? "text-sky-700 dark:text-sky-300"
        : emailTone === "needs-verification"
          ? "text-amber-700 dark:text-amber-300"
          : undefined;

  return (
    <FieldSet className="gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="newEmail" className="sr-only">
            Email
          </FieldLabel>
          <InputGroup className="h-10 pr-2">
            <InputGroupInput
              id="newEmail"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              inputMode="email"
              placeholder="name@example.com"
              type="email"
              aria-invalid={Boolean(error) || undefined}
              {...form.register("newEmail")}
            />
            <InputGroupAddon align="inline-end" className="pr-1">
              {displayedEmailVerified ? (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-medium text-emerald-700 text-sm dark:text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  Verified
                </span>
              ) : (
                <InputGroupButton
                  className="text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-200"
                  disabled={isSendingVerification || resendCooldownSeconds > 0}
                  onClick={sendVerificationEmail}
                  type="button"
                  variant="ghost"
                >
                  <RefreshCw data-icon="inline-start" />
                  {isSendingVerification
                    ? "Sending..."
                    : resendCooldownSeconds > 0
                      ? `Resend in ${formatCooldown(resendCooldownSeconds)}`
                      : "Verify email"}
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          {note ? (
            <FieldDescription className={noteClassName}>
              {note}
            </FieldDescription>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Button
          className="w-full"
          disabled={!hasEmailChange || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? "Updating..." : "Update email"}
        </Button>
      </form>
    </FieldSet>
  );
}

export { AccountEmailManager };
