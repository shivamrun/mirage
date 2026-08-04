"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  type RegisterFormInput,
  type RegisterFormValues,
  registerFormSchema,
} from "@/zod";

function RegisterForm({
  redirectTo = "/",
  googleAuthEnabled = false,
}: {
  redirectTo?: string;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const form = useForm<RegisterFormInput, undefined, RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(undefined);

    try {
      const result = await authClient.signUp.email({
        ...values,
        name: "",
        callbackURL: "/email-verification?status=success",
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      setIsRedirecting(true);
      router.push(redirectTo);
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    }
  }

  async function validateSocialAuthConsent() {
    return form.trigger("agreeToTerms", { shouldFocus: true });
  }

  return (
    <AuthFormShell
      title="Create your account"
      description="Tell us the basics and we'll get Grove ready for you."
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="link-text"
            href={
              redirectTo === "/"
                ? "/login"
                : `/login?callbackURL=${encodeURIComponent(redirectTo)}`
            }
          >
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          {error ? (
            <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
          ) : null}
          <EmailField
            id="email"
            description="We'll use this for sign-in and account updates."
            error={form.formState.errors.email?.message}
            placeholder="you@company.com"
            required
            {...form.register("email")}
          />
          <PasswordField
            autoComplete="new-password"
            description="Use at least 8 characters. Longer is even better."
            id="password"
            error={form.formState.errors.password?.message}
            minLength={8}
            placeholder="Create a password"
            required
            {...form.register("password")}
          />
          <Controller
            control={form.control}
            name="agreeToTerms"
            render={({ field, fieldState }) => {
              const errorId = "agree-to-terms-error";

              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-describedby={fieldState.error ? errorId : undefined}
                      aria-invalid={fieldState.invalid}
                      checked={field.value}
                      id="agree-to-terms"
                      name={field.name}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      className="relative mt-px"
                      ref={field.ref}
                    />
                    <label
                      className="text-muted-foreground text-xs leading-5"
                      htmlFor="agree-to-terms"
                    >
                      By proceeding, you agree to the{" "}
                      <Link href="/#" className="link-text">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/#" className="link-text">
                        Privacy Policy
                      </Link>{" "}
                    </label>
                  </div>
                  {fieldState.error ? (
                    <FieldError id={errorId}>
                      {fieldState.error.message}
                    </FieldError>
                  ) : null}
                </div>
              );
            }}
          />
        </FieldGroup>
        <Button
          className="w-full"
          disabled={form.formState.isSubmitting || isRedirecting}
          type="submit"
        >
          {isRedirecting
            ? "Redirecting..."
            : form.formState.isSubmitting
              ? "Creating account..."
              : "Create account"}
        </Button>
        {googleAuthEnabled ? (
          <>
            <AuthDivider label="OR" />
            <GoogleAuthButton
              redirectTo={redirectTo}
              onBeforeSignIn={validateSocialAuthConsent}
            />
          </>
        ) : null}
      </form>
    </AuthFormShell>
  );
}

export { RegisterForm };
