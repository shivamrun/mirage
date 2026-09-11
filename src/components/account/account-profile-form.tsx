"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, LoaderCircle, RotateCcw, Save, Trash2 } from "lucide-react";
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
import { ImageCropper } from "@/components/ui/image-cropper";
import { authClient } from "@/lib/auth/client";
import {
  avatarAcceptedMimeTypes,
  avatarCropMaxFileSize,
  avatarCropOutputType,
  avatarSourceMaxFileSize,
  getCroppedAvatarFilename,
  resolveUploadPublicUrl,
  uploadAvatarFile,
} from "@/lib/uploads";
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

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} MB`;
}

function AccountProfileForm({
  onSessionRefresh,
  user,
}: {
  onSessionRefresh: () => Promise<void>;
  user: AccountProfileUser;
}) {
  const [status, setStatus] = React.useState<StatusMessage>();
  const [uploadProgress, setUploadProgress] = React.useState<number>();
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [cropFile, setCropFile] = React.useState<File | null>(null);
  const [cropImageUrl, setCropImageUrl] = React.useState<string>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
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
  const previewImageUrl = resolveUploadPublicUrl(
    previewImage,
    process.env.NEXT_PUBLIC_UPLOAD_BASE_URL,
  );
  const previewName =
    typeof nameValue === "string" && nameValue.trim() ? nameValue : user.name;
  const [failedImage, setFailedImage] = React.useState<string>();
  const shouldShowImage = Boolean(
    previewImageUrl &&
      isValidImageURL(previewImageUrl) &&
      failedImage !== previewImageUrl,
  );
  const isCroppingAvatar = Boolean(cropFile);
  const isBusy =
    form.formState.isSubmitting || isUploadingAvatar || isCroppingAvatar;

  React.useEffect(() => {
    form.reset({
      image: user.image ?? "",
      name: user.name,
    });
  }, [form, user]);

  React.useEffect(() => {
    if (!cropFile) {
      setCropImageUrl(undefined);
      return;
    }

    const url = URL.createObjectURL(cropFile);
    setCropImageUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [cropFile]);

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

  async function uploadAvatar(file: File) {
    setStatus(undefined);
    setUploadProgress(0);
    setIsUploadingAvatar(true);

    try {
      const uploaded = await uploadAvatarFile(file, {
        onProgress: ({ percent }) => {
          setUploadProgress(percent ?? 0);
        },
      });

      setFailedImage(undefined);
      form.setValue("image", uploaded.key, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setStatus({
        text: "Avatar uploaded. Save your profile to keep it.",
        tone: "success",
      });
    } catch (reason) {
      setStatus({
        text:
          reason instanceof Error
            ? reason.message
            : "Could not upload the avatar.",
        tone: "error",
      });
    } finally {
      setIsUploadingAvatar(false);
      setUploadProgress(undefined);
    }
  }

  function onAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!avatarAcceptedMimeTypes.includes(file.type)) {
      setStatus({
        text: "Choose a JPEG, PNG, or WebP image.",
        tone: "error",
      });
      return;
    }

    if (file.size > avatarSourceMaxFileSize) {
      setStatus({
        text: `Choose an image smaller than ${formatFileSize(avatarSourceMaxFileSize)}.`,
        tone: "error",
      });
      return;
    }

    setStatus(undefined);
    setCropFile(file);
  }

  function clearAvatar() {
    setFailedImage(undefined);
    form.setValue("image", "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function resetAvatar() {
    setFailedImage(undefined);
    form.setValue("image", user.image ?? "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  return (
    <>
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
            <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary text-xl">
              {shouldShowImage ? (
                <Image
                  alt={`${previewName} profile`}
                  className="size-full object-cover"
                  height={64}
                  onError={() => setFailedImage(previewImageUrl ?? undefined)}
                  src={previewImageUrl ?? ""}
                  unoptimized
                  width={64}
                />
              ) : (
                <span>{getInitials(previewName)}</span>
              )}
              {isUploadingAvatar ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <LoaderCircle className="size-5 animate-spin" />
                </div>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{previewName}</p>
              <p className="text-muted-foreground text-sm">
                {typeof uploadProgress === "number"
                  ? `Uploading ${Math.round(uploadProgress)}%`
                  : "Profile picture"}
              </p>
            </div>
          </div>
          <input
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={isBusy}
            onChange={onAvatarFileChange}
            ref={fileInputRef}
            type="file"
          />
          <input type="hidden" {...form.register("image")} />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <ImageUp data-icon="inline-start" />
              Choose avatar
            </Button>
            {previewImage ? (
              <Button
                disabled={isBusy}
                onClick={clearAvatar}
                type="button"
                variant="outline"
              >
                <Trash2 data-icon="inline-start" />
                Clear
              </Button>
            ) : null}
            {previewImage !== (user.image ?? "") ? (
              <Button
                disabled={isBusy}
                onClick={resetAvatar}
                type="button"
                variant="ghost"
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            ) : null}
          </div>
          {form.formState.errors.image?.message ? (
            <p className="text-destructive text-sm">
              {form.formState.errors.image.message}
            </p>
          ) : null}
          <AuthInputField
            id="name"
            label="Name"
            error={form.formState.errors.name?.message}
            placeholder="Your name"
            required
            {...form.register("name")}
          />
        </FieldGroup>
        <Button className="w-full sm:w-fit" disabled={isBusy} type="submit">
          {form.formState.isSubmitting ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {form.formState.isSubmitting ? "Saving..." : "Save profile"}
        </Button>
      </form>
      <ImageCropper
        aspect={1}
        imageSrc={cropImageUrl ?? ""}
        maxFileSizeBytes={avatarCropMaxFileSize}
        maxOutputHeight={512}
        maxOutputWidth={512}
        onCancel={() => setCropFile(null)}
        onConfirm={(blob) => {
          if (!cropFile) {
            return;
          }

          const file = new File(
            [blob],
            getCroppedAvatarFilename(cropFile.name),
            {
              lastModified: Date.now(),
              type: blob.type || avatarCropOutputType,
            },
          );

          setCropFile(null);
          void uploadAvatar(file);
        }}
        onError={(error) => {
          setStatus({
            text: error.message,
            tone: "error",
          });
          setCropFile(null);
        }}
        open={Boolean(cropFile && cropImageUrl)}
        outputType={avatarCropOutputType}
      />
    </>
  );
}

export { AccountProfileForm };
