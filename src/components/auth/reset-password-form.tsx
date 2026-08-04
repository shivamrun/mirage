"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import { PasswordField } from "@/components/auth/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  type ResetPasswordInput,
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/zod";

const resetLinkErrorMessages: Record<string, string> = {
  INVALID_TOKEN:
    "That reset link is invalid or expired. Please request a new one.",
  TOKEN_EXPIRED: "That reset link has expired. Please request a new one.",
};

function getResetLinkErrorMessage(error?: string) {
  if (!error) {
    return;
  }

  return Object.hasOwn(resetLinkErrorMessages, error)
    ? resetLinkErrorMessages[error]
    : "That reset link could not be used. Please request a new one.";
}

function ResetPasswordForm({
  error: linkError,
  token,
}: {
  error?: string;
  token?: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const linkErrorMessage = getResetLinkErrorMessage(linkError);
  const canSubmit = Boolean(token && !linkErrorMessage);
  const form = useForm<ResetPasswordInput, undefined, ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setError(undefined);

    if (!canSubmit) {
      setError(
        linkErrorMessage ||
          "That reset link is missing a token. Please request a new one.",
      );
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token: values.token,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      router.push("/login?reset=success");
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    }
  }

  return (
    <AuthFormShell
      title="Set a new password"
      description="Choose something fresh and you'll be back in shortly."
      footer={
        <Link className="link-text" href="/forgot-password">
          Get a new reset link
        </Link>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          {linkErrorMessage || !token ? (
            <AuthStatusMessage tone="error">
              {linkErrorMessage || "That reset link is missing a token."}
            </AuthStatusMessage>
          ) : null}
          {error ? (
            <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
          ) : null}
          <PasswordField
            autoComplete="new-password"
            description="Pick a password you have not used here before."
            disabled={!canSubmit}
            id="password"
            error={form.formState.errors.password?.message}
            minLength={8}
            placeholder="New password"
            required
            {...form.register("password")}
          />
          <PasswordField
            autoComplete="new-password"
            disabled={!canSubmit}
            id="confirmPassword"
            description="Type it once more so we know it matches."
            error={form.formState.errors.confirmPassword?.message}
            label="Confirm password"
            minLength={8}
            placeholder="New password again"
            required
            {...form.register("confirmPassword")}
          />
          <input type="hidden" {...form.register("token")} />
        </FieldGroup>
        <Button
          className="w-full"
          disabled={form.formState.isSubmitting || !canSubmit}
          type="submit"
        >
          {form.formState.isSubmitting
            ? "Updating password..."
            : "Update password"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { ResetPasswordForm };
