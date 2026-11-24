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
import {
  EmailField,
  PasswordField,
} from "@/features/auth/components/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/features/auth/components/auth-form-shell";
import {
  AuthDivider,
  GoogleAuthButton,
} from "@/features/auth/components/google-auth-button";
import {
  type LoginInput,
  type LoginValues,
  loginSchema,
} from "@/shared/schemas";

function LoginForm({
  redirectTo = "/account",
  resetSuccess = false,
  googleAuthEnabled = false,
}: {
  redirectTo?: string;
  resetSuccess?: boolean;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const turnstileRef = React.useRef<TurnstileInstance>(null);
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

    if (!turnstileToken) {
      setError("Complete the security check before signing in.");
      return;
    }

    try {
      const result = await authClient.signIn.email({
        ...values,
        callbackURL: redirectTo,
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
      setTurnstileToken("");
      turnstileRef.current?.reset();
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
              redirectTo === "/account"
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
            <TurnstileField
              action="auth"
              id="login-turnstile"
              onTokenChange={setTurnstileToken}
              ref={turnstileRef}
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
            disabled={
              form.formState.isSubmitting || isRedirecting || !turnstileToken
            }
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
