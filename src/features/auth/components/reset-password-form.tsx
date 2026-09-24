"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { TurnstileField } from "@/components/turnstile-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/features/auth/better-auth/client";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { PasswordField } from "@/features/auth/components/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/features/auth/components/auth-form-shell";
import {
  type ResetPasswordInput,
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/shared/schemas";

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
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const turnstileRef = React.useRef<TurnstileInstance>(null);
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

    if (!turnstileToken) {
      setError("Complete the security check before updating your password.");
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token: values.token,
        fetchOptions: {
          headers: {
            "x-captcha-response": turnstileToken,
          },
        },
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        setTurnstileToken("");
        turnstileRef.current?.reset();
        return;
      }

      router.push("/login?reset=success");
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
      setTurnstileToken("");
      turnstileRef.current?.reset();
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
          {canSubmit ? (
            <TurnstileField
              action="auth"
              id="reset-password-turnstile"
              onTokenChange={setTurnstileToken}
              ref={turnstileRef}
            />
          ) : null}
        </FieldGroup>
        <Button
          className="w-full"
          disabled={
            form.formState.isSubmitting || !canSubmit || !turnstileToken
          }
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
