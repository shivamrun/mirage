"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import { AuthInputField } from "@/components/auth/auth-fields";
import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

function TwoFactorForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [trustDevice, setTrustDevice] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: code.replace(/\s/g, ""),
        trustDevice,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
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
          <AuthInputField
            autoComplete="one-time-code"
            inputMode="numeric"
            id="totp-code"
            label="Authenticator code"
            maxLength={8}
            minLength={6}
            onChange={(event) => setCode(event.target.value)}
            pattern="[0-9 ]*"
            placeholder="123456"
            required
            value={code}
          />
          <Field orientation="horizontal">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor="trust-device">Trust this device</FieldLabel>
            </FieldContent>
          </Field>
        </FieldGroup>
        <Button className="w-full" disabled={isSubmitting} type="submit">
          <ShieldCheck data-icon="inline-start" />
          {isSubmitting ? "Verifying..." : "Verify code"}
        </Button>
      </form>
    </AuthFormShell>
  );
}

export { TwoFactorForm };
