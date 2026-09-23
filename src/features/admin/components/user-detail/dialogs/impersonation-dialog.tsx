"use client";

import { Fingerprint } from "lucide-react";
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
import { authClient } from "@/features/auth/better-auth/client";
import { AuthStatusMessage } from "@/features/auth/components";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { cn } from "@/shared/utils";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

type AdminUserImpersonateDialogProps = {
  className?: string;
  currentUserId: string;
  userId: string;
  userName: string;
};

export function AdminUserImpersonateDialog({
  className,
  currentUserId,
  userId,
  userName,
}: AdminUserImpersonateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isCurrentUser = currentUserId === userId;

  async function impersonateUser() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.admin.impersonateUser({
        userId,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.push("/account");
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCurrentUser) {
    return (
      <Button
        className={cn("min-w-0 gap-2", className)}
        disabled
        size="xs"
        type="button"
        variant="outline"
      >
        <Fingerprint className="size-4 shrink-0" />
        <span className="min-w-0 truncate">Current admin</span>
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          aria-haspopup="dialog"
          className={cn("min-w-0 gap-2", className)}
          size="xs"
          type="button"
          variant="outline"
        >
          <Fingerprint className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Impersonate</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impersonate user</AlertDialogTitle>
          <AlertDialogDescription>
            Start a temporary session as {userName}. You can stop impersonating
            from the account page.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>

          <Button
            disabled={isSubmitting}
            onClick={impersonateUser}
            type="button"
          >
            <Fingerprint data-icon="inline-start" />
            {isSubmitting ? "Starting..." : "Start impersonating"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
