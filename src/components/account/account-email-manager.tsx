"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RiCloseLine, RiRefreshLine, RiSave3Line } from "@remixicon/react";
import * as React from "react";
import { useForm } from "react-hook-form";

import { AuthInputField, AuthStatusMessage } from "@/components/auth";
import { getUnexpectedAuthErrorMessage } from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldSet } from "@/components/ui/field";
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

async function readAccountError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
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
      newEmail: "",
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
  }, [user.email, user.emailVerified]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadEmailState() {
      const response = await fetch("/api/account");

      if (!response.ok) {
        return;
      }

      const nextEmailState = (await response.json()) as AccountEmailResponse;

      if (isMounted) {
        setEmailState(nextEmailState);
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
      const response = await fetch("/api/account/resend-verification", {
        method: "POST",
      });

      if (!response.ok) {
        setStatus({
          text: await readAccountError(response),
          tone: "error",
        });
        return;
      }

      const nextEmailState = (await response.json()) as AccountEmailResponse;
      setEmailState(nextEmailState);
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
      const response = await fetch("/api/account/change-email", {
        body: JSON.stringify({ newEmail: values.newEmail }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        setStatus({
          text: await readAccountError(response),
          tone: "error",
        });
        return;
      }

      const nextEmailState = (await response.json()) as AccountEmailResponse;
      setEmailState(nextEmailState);
      await onSessionRefresh();
      form.reset();
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
      const response = await fetch("/api/account/cancel-email-change", {
        method: "POST",
      });

      if (!response.ok) {
        setStatus({
          text: await readAccountError(response),
          tone: "error",
        });
        return;
      }

      const nextEmailState = (await response.json()) as AccountEmailResponse;
      setEmailState(nextEmailState);
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
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{emailState.email}</p>
          <FieldDescription>
            {emailState.emailVerified ? "Verified" : "Not verified"}
          </FieldDescription>
          {emailState.pendingEmail ? (
            <FieldDescription>
              Pending change to {emailState.pendingEmail}
              {pendingEmailExpiresAt
                ? `, expires ${pendingEmailExpiresAt.toLocaleString()}`
                : ""}
            </FieldDescription>
          ) : null}
        </div>
        <span
          className={
            emailState.emailVerified
              ? "rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 text-xs dark:bg-emerald-950/40 dark:text-emerald-300"
              : "rounded-lg bg-muted px-2 py-1 text-muted-foreground text-xs"
          }
        >
          {emailState.emailVerified ? "Verified" : "Optional"}
        </span>
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
            id="currentEmail"
            label="Current email"
            readOnly
            value={emailState.email}
          />
          <AuthInputField
            id="newEmail"
            label="New email"
            error={form.formState.errors.newEmail?.message}
            placeholder="new@company.com"
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
