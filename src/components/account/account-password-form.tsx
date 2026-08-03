"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RiSave3Line } from "@remixicon/react";
import * as React from "react";
import { useForm } from "react-hook-form";

import { AuthStatusMessage, PasswordField } from "@/components/auth";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  type ChangePasswordInput,
  type ChangePasswordValues,
  changePasswordSchema,
} from "@/zod";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

function AccountPasswordForm() {
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<ChangePasswordInput, undefined, ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordValues) {
    setStatus(undefined);

    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      form.reset();
      setStatus({ text: "Password updated.", tone: "success" });
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        {status ? (
          <AuthStatusMessage tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}
        <PasswordField
          id="currentPassword"
          label="Current password"
          error={form.formState.errors.currentPassword?.message}
          placeholder="Current password"
          required
          {...form.register("currentPassword")}
        />
        <PasswordField
          autoComplete="new-password"
          id="newPassword"
          label="New password"
          error={form.formState.errors.newPassword?.message}
          minLength={8}
          placeholder="New password"
          required
          {...form.register("newPassword")}
        />
        <PasswordField
          autoComplete="new-password"
          id="confirmPassword"
          label="Confirm password"
          error={form.formState.errors.confirmPassword?.message}
          minLength={8}
          placeholder="New password again"
          required
          {...form.register("confirmPassword")}
        />
      </FieldGroup>
      <Button
        className="w-full sm:w-fit"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        <RiSave3Line data-icon="inline-start" />
        {form.formState.isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

export { AccountPasswordForm };
