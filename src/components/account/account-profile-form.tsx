"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import Image from "next/image";
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

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "G";
}

function isValidImageURL(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
  const imageValue = form.watch("image");
  const nameValue = form.watch("name");
  const previewImage = typeof imageValue === "string" ? imageValue.trim() : "";
  const previewName =
    typeof nameValue === "string" && nameValue.trim() ? nameValue : user.name;
  const [failedImage, setFailedImage] = React.useState<string>();
  const shouldShowImage =
    isValidImageURL(previewImage) && failedImage !== previewImage;

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
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary text-xl">
            {shouldShowImage ? (
              <Image
                alt={`${previewName} profile`}
                className="size-full object-cover"
                height={64}
                onError={() => setFailedImage(previewImage)}
                src={previewImage}
                unoptimized
                width={64}
              />
            ) : (
              <span>{getInitials(previewName)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{previewName}</p>
            <p className="text-muted-foreground text-sm">Profile picture</p>
          </div>
        </div>
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
        <Save data-icon="inline-start" />
        {form.formState.isSubmitting ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

export { AccountProfileForm };
