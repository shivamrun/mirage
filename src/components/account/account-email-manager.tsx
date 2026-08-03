"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RiCloseLine, RiRefreshLine, RiSave3Line } from "@remixicon/react";
import * as React from "react";
import { useForm } from "react-hook-form";

import { AuthInputField, AuthStatusMessage } from "@/components/auth";
import { getUnexpectedAuthErrorMessage } from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldSet } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import {
  type ChangeEmailInput,
  type ChangeEmailValues,
  changeEmailSchema,
} from "@/zod";

type EmailManagerUser = {
  email: string;
  emailVerified: boolean;
};

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

type AccountEmailResponse = {
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingEmailExpiresAt: string | null;
};

function readAccountError(error: { value?: unknown } | null) {
  const body = error?.value as {
    message?: string;
  } | null;

  return body?.message || "Something went wrong. Please try again.";
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
  const [status, setStatus] = React.useState<StatusMessage>();
  const [emailState, setEmailState] = React.useState<AccountEmailResponse>({
    email: user.email,
    emailVerified: user.emailVerified,
    pendingEmail: null,
    pendingEmailExpiresAt: null,
  });
  const [isSendingVerification, setIsSendingVerification] =
    React.useState(false);
  const [isCancellingEmailChange, setIsCancellingEmailChange] =
    React.useState(false);
  const form = useForm<ChangeEmailInput, undefined, ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: user.email,
    },
  });

  React.useEffect(() => {
    if (emailChangeStatus === "success") {
      onSessionRefresh().catch(() => undefined);
      setStatus({
        text: "Email address updated.",
        tone: "success",
      });
      return;
    }

    if (emailChangeStatus === "expired") {
      setStatus({
        text: "That email change link expired. Start a new change below.",
        tone: "error",
      });
      return;
    }

    if (emailChangeStatus === "invalid") {
      setStatus({
        text: "That email change link is invalid. Start a new change below.",
        tone: "error",
      });
    }
  }, [emailChangeStatus, onSessionRefresh]);

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
        setEmailState(data as AccountEmailResponse);
      }
    }

    loadEmailState().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  async function sendVerificationEmail() {
    if (emailState.emailVerified) {
      return;
    }

    setStatus(undefined);
    setIsSendingVerification(true);

    try {
      const { data, error } =
        await api.api.account["resend-verification"].post();

      if (error) {
        setStatus({
          text: readAccountError(error),
          tone: "error",
        });
        return;
      }

      setEmailState(data as AccountEmailResponse);
      setStatus({
        text: "Verification link sent.",
        tone: "success",
      });
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsSendingVerification(false);
    }
  }

  async function onSubmit(values: ChangeEmailValues) {
    setStatus(undefined);

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
        setStatus({
          text: readAccountError(error),
          tone: "error",
        });
        return;
      }

      setEmailState(data as AccountEmailResponse);
      await onSessionRefresh();
      form.reset({
        newEmail: (data as AccountEmailResponse).email,
      });
      setStatus({
        text: "Check the new email address to confirm this change.",
        tone: "success",
      });
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  async function cancelEmailChange() {
    setStatus(undefined);
    setIsCancellingEmailChange(true);

    try {
      const { data, error } =
        await api.api.account["cancel-email-change"].post();

      if (error) {
        setStatus({
          text: readAccountError(error),
          tone: "error",
        });
        return;
      }

      setEmailState(data as AccountEmailResponse);
      form.reset({
        newEmail: (data as AccountEmailResponse).email,
      });
      setStatus({
        text: "Pending email change canceled.",
        tone: "success",
      });
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsCancellingEmailChange(false);
    }
  }

  const pendingEmailExpiresAt = emailState.pendingEmailExpiresAt
    ? new Date(emailState.pendingEmailExpiresAt)
    : null;

  return (
    <FieldSet>
      <div className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5">
        <div className="flex items-start justify-between gap-4">
          <p className="font-medium text-sm">Email</p>
          <span
            className={
              emailState.emailVerified
                ? "font-medium text-emerald-700 text-sm dark:text-emerald-300"
                : "text-muted-foreground text-sm"
            }
          >
            {emailState.emailVerified ? "Verified" : "Not verified"}
          </span>
        </div>
        {emailState.pendingEmail ? (
          <FieldDescription>
            Pending change to {emailState.pendingEmail}
            {pendingEmailExpiresAt
              ? `, expires ${pendingEmailExpiresAt.toLocaleString()}`
              : ""}
          </FieldDescription>
        ) : null}
      </div>

      {status ? (
        <AuthStatusMessage tone={status.tone}>{status.text}</AuthStatusMessage>
      ) : null}

      <Button
        disabled={emailState.emailVerified || isSendingVerification}
        onClick={sendVerificationEmail}
        type="button"
        variant="outline"
      >
        <RiRefreshLine data-icon="inline-start" />
        {isSendingVerification ? "Sending..." : "Send verification link"}
      </Button>

      {emailState.pendingEmail ? (
        <Button
          disabled={isCancellingEmailChange}
          onClick={cancelEmailChange}
          type="button"
          variant="outline"
        >
          <RiCloseLine data-icon="inline-start" />
          {isCancellingEmailChange ? "Canceling..." : "Cancel email change"}
        </Button>
      ) : null}

      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          <AuthInputField
            id="newEmail"
            label="Current email"
            error={form.formState.errors.newEmail?.message}
            required
            type="email"
            {...form.register("newEmail")}
          />
        </FieldGroup>
        <Button
          className="w-full"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          <RiSave3Line data-icon="inline-start" />
          {form.formState.isSubmitting ? "Changing..." : "Change email"}
        </Button>
      </form>
    </FieldSet>
  );
}

export { AccountEmailManager };
