"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RiSave3Line } from "@remixicon/react";
import * as React from "react";
import { useForm } from "react-hook-form";

import { AuthInputField, AuthStatusMessage } from "@/components/auth";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import {
  type AccountProfileInput,
  type AccountProfileValues,
  accountProfileSchema,
} from "@/zod";

type AccountProfileUser = {
  image?: string | null;
  name: string;
};

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

function AccountProfileForm({
  onSessionRefresh,
  user,
}: {
  onSessionRefresh: () => Promise<void>;
  user: AccountProfileUser;
}) {
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<AccountProfileInput, undefined, AccountProfileValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: {
      image: "",
      name: "",
    },
  });

  React.useEffect(() => {
    form.reset({
      image: user.image ?? "",
      name: user.name,
    });
  }, [form, user]);

  async function onSubmit(values: AccountProfileValues) {
    setStatus(undefined);

    try {
      const result = await authClient.updateUser({
        image: values.image,
        name: values.name,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      await onSessionRefresh();
      setStatus({ text: "Profile updated.", tone: "success" });
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
        <AuthInputField
          id="name"
          label="Name"
          error={form.formState.errors.name?.message}
          placeholder="Your name"
          required
          {...form.register("name")}
        />
        <AuthInputField
          id="image"
          label="Image URL"
          error={form.formState.errors.image?.message}
          placeholder="https://example.com/avatar.png"
          type="url"
          {...form.register("image")}
        />
      </FieldGroup>
      <Button
        className="w-full sm:w-fit"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        <RiSave3Line data-icon="inline-start" />
        {form.formState.isSubmitting ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

export { AccountProfileForm };
