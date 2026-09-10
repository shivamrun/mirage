"use client";

import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AuthStatusMessage } from "@/components/auth";
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

type StatusMessage = {
  message: string;
  tone: "error" | "success";
};

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === "string"
      ? body.message
      : "Could not create email list.";
  } catch {
    return "Could not create email list.";
  }
}

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

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/email-list", {
      body: JSON.stringify({
        description: formData.get("description"),
        emailVerificationRequired:
          formData.get("emailVerificationRequired") === "true",
        key: formData.get("key"),
        name: formData.get("name"),
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setStatus({
        message: await readErrorMessage(response),
        tone: "error",
      });
      return;
    }

    setOpen(false);
    router.refresh();
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
