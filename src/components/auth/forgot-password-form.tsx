"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import { EmailField } from "@/components/auth/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  type ForgotPasswordInput,
  type ForgotPasswordValues,
  forgotPasswordSchema,
} from "@/zod";

function ForgotPasswordForm() {
  const [error, setError] = React.useState<string>();
  const [success, setSuccess] = React.useState<string>();
  const form = useForm<ForgotPasswordInput, undefined, ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setError(undefined);
    setSuccess(undefined);

    try {
      const result = await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      setSuccess(
        result.data?.message ||
          "If that email exists, a reset link is on the way.",
      );
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    }
  }

  return (
    <AuthFormShell
      title="Reset password"
      description="Enter your email and we will send a reset link."
      footer={
        <Link className="font-medium text-primary" href="/login">
          Back to sign in
        </Link>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          {success ? (
            <AuthStatusMessage tone="success">{success}</AuthStatusMessage>
          ) : null}
          {error ? (
            <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
          ) : null}
          <EmailField
            id="email"
            description="Send the link to the email on your account."
            error={form.formState.errors.email?.message}
            placeholder="you@company.com"
            required
            {...form.register("email")}
          />
        </FieldGroup>
        <Button
          className="w-full"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? "Sending link..." : "Send reset link"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { ForgotPasswordForm };
