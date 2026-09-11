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
import { EmailField, PasswordField } from "@/components/auth/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import {
  AuthDivider,
  GoogleAuthButton,
} from "@/components/auth/google-auth-button";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { type LoginInput, type LoginValues, loginSchema } from "@/zod";

function LoginForm({
  redirectTo = "/",
  resetSuccess = false,
  googleAuthEnabled = false,
}: {
  redirectTo?: string;
  resetSuccess?: boolean;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const form = useForm<LoginInput, undefined, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setError(undefined);

    try {
      const result = await authClient.signIn.email({
        ...values,
        callbackURL: redirectTo,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      if (
        result.data &&
        "twoFactorRedirect" in result.data &&
        result.data.twoFactorRedirect
      ) {
        setIsRedirecting(true);
        router.push(
          `/two-factor?callbackURL=${encodeURIComponent(redirectTo)}`,
        );
        return;
      }

      setIsRedirecting(true);
      router.push(result.data?.url ?? redirectTo);
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    }
  }

  return (
    <AuthFormShell
      title="Welcome Back"
      description="Sign in with your email and password."
      footer={
        <>
          New here?{" "}
          <Link
            className="link-text"
            href={
              redirectTo === "/"
                ? "/register"
                : `/register?callbackURL=${encodeURIComponent(redirectTo)}`
            }
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FieldGroup>
            {resetSuccess ? (
              <AuthStatusMessage tone="success">
                Your password was updated. You can sign in now.
              </AuthStatusMessage>
            ) : null}
            {error ? (
              <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
            ) : null}
            <EmailField
              id="email"
              description="Use the email you signed up with."
              error={form.formState.errors.email?.message}
              placeholder="you@company.com"
              required
              {...form.register("email")}
            />
            <PasswordField
              id="password"
              description="Enter your account password."
              error={form.formState.errors.password?.message}
              placeholder="*********"
              required
              {...form.register("password")}
            />
          </FieldGroup>
          <Link
            className="link-text text-sm hover:brightness-100"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
          <Button
            className="w-full"
            disabled={form.formState.isSubmitting || isRedirecting}
            type="submit"
          >
            {isRedirecting
              ? "Redirecting..."
              : form.formState.isSubmitting
                ? "Signing in..."
                : "Sign in"}
          </Button>
        </form>
        {googleAuthEnabled ? (
          <>
            <AuthDivider label="OR" />
            <GoogleAuthButton redirectTo={redirectTo} />
          </>
        ) : null}
      </div>
    </AuthFormShell>
  );
}

export { LoginForm };
