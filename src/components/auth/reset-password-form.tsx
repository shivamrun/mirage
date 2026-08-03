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
  INVALID_TOKEN: "This reset link is invalid or expired. Request a new link.",
  TOKEN_EXPIRED: "This reset link has expired. Request a new link.",
};

function getResetLinkErrorMessage(error?: string) {
  if (!error) {
    return;
  }

  return Object.hasOwn(resetLinkErrorMessages, error)
    ? resetLinkErrorMessages[error]
    : "This reset link could not be used. Request a new link.";
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
          "This reset link is missing a token. Request a new link.",
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
      title="Choose a new password"
      description="Set a fresh password for your Grove account."
      footer={
        <Link className="font-medium text-primary" href="/forgot-password">
          Request a new link
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
              {linkErrorMessage || "This reset link is missing a token."}
            </AuthStatusMessage>
          ) : null}
          {error ? (
            <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
          ) : null}
          <PasswordField
            autoComplete="new-password"
            description="Choose something you have not used here before."
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
            description="Type it again so we know it matches."
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
