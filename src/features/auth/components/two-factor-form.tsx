"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/features/auth/better-auth/client";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { AuthOtpField } from "@/features/auth/components/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/features/auth/components/auth-form-shell";
import { api } from "@/shared/api/client";

function TwoFactorForm({
  mode = "login",
  redirectTo = "/account",
}: {
  mode?: "admin-step-up" | "login";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const hasCode = code.replace(/\D/g, "").length === 6;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasCode) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      const normalizedCode = code.replace(/\s/g, "");

      if (mode === "admin-step-up") {
        const result = await api.api.account["admin-step-up"].totp.post({
          code: normalizedCode,
        });

        if (result.error) {
          setError(result.error.value.message);
          return;
        }
      } else {
        const result = await authClient.twoFactor.verifyTotp({
          code: normalizedCode,
        });

        if (result.error) {
          setError(getAuthErrorMessage(result.error));
          return;
        }
      }

      if (mode === "login" && redirectTo.startsWith("/admin")) {
        const stepUpResult = await api.api.account["admin-step-up"].totp.post({
          code: normalizedCode,
        });

        if (stepUpResult.error) {
          setError(stepUpResult.error.value.message);
          return;
        }
      }

      router.push(redirectTo);
      router.refresh();
    } catch (reason) {
      setError(getUnexpectedAuthErrorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormShell
      title="Two-factor check"
      description="Enter the code from your authenticator app."
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <FieldGroup>
          {error ? (
            <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
          ) : null}
          <div className="flex items-center justify-center w-full">
            <AuthOtpField
              id="totp-code"
              labelSrOnly
              label="Authenticator code"
              onChange={setCode}
              required
              value={code}
            />
          </div>
        </FieldGroup>
        <Button
          className="w-full"
          disabled={isSubmitting || !hasCode}
          type="submit"
        >
          <ShieldCheck data-icon="inline-start" />
          {isSubmitting ? "Verifying..." : "Verify code"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { TwoFactorForm };
