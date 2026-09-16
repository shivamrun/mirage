"use client";

import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AuthStatusMessage } from "@/features/auth/components";
import { api } from "@/shared/api/client";

type StatusMessage = {
  message: string;
  tone: "error" | "success";
};

export function EmailListCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();

  React.useEffect(() => {
    if (!open) {
      setStatus(undefined);
      setIsSubmitting(false);
    }
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const { error } = await api.api.admin["email-list"].post({
        description: formString(formData, "description"),
        emailVerificationRequired:
          formData.get("emailVerificationRequired") === "true",
        key: requiredFormString(formData, "key"),
        name: requiredFormString(formData, "name"),
      });

      if (error) {
        setStatus({
          message: getEdenMessage(error, "Could not create email list."),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setStatus({
        message: "Could not create email list.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button">
          <ListPlus data-icon="inline-start" />
          Create list
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create email list</AlertDialogTitle>
          <AlertDialogDescription>
            Add a custom list that uses the shared signup and verification flow.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {status ? (
            <AuthStatusMessage tone={status.tone}>
              {status.message}
            </AuthStatusMessage>
          ) : null}
          <Input name="key" placeholder="product-updates" required />
          <Input name="name" placeholder="Product updates" required />
          <Input name="description" placeholder="Optional description" />
          <label
            className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
            htmlFor="email-list-verification-required"
          >
            <Checkbox
              defaultChecked
              id="email-list-verification-required"
              name="emailVerificationRequired"
              value="true"
            />
            Require email verification
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create list"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function requiredFormString(formData: FormData, key: string) {
  return formString(formData, key) ?? "";
}

function getEdenMessage(error: { value?: unknown } | null, fallback: string) {
  const value = error?.value;

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return fallback;
}
