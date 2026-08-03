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
import {
  EmailField,
  NameField,
  PasswordField,
} from "@/components/auth/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { type RegisterInput, type RegisterValues, registerSchema } from "@/zod";

function RegisterForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const form = useForm<RegisterInput, undefined, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setError(undefined);

    try {
      const result = await authClient.signUp.email({
        ...values,
        callbackURL: "/email-verification?status=success",
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    }
  }

  return (
    <AuthFormShell
      title="Create account"
      description="Start with your name, email, and a password."
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="font-medium text-primary"
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
          <NameField
            id="name"
            description="This is what we will call you in Grove."
            error={form.formState.errors.name?.message}
            placeholder="Your name"
            required
            {...form.register("name")}
          />
          <EmailField
            id="email"
            description="We will use this for sign in and account updates."
            error={form.formState.errors.email?.message}
            placeholder="you@company.com"
            required
            {...form.register("email")}
          />
          <PasswordField
            autoComplete="new-password"
            description="Use at least 8 characters. A little longer is better."
            id="password"
            error={form.formState.errors.password?.message}
            minLength={8}
            placeholder="Create a password"
            required
            {...form.register("password")}
          />
        </FieldGroup>
        <Button
          className="w-full"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting
            ? "Creating account..."
            : "Create account"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { RegisterForm };
