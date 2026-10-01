"use client";

import { MoreHorizontal, RefreshCw, XCircle } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthStatusMessage } from "@/features/auth/components";
import { api } from "@/shared/api/client";

type Action = "resend" | "revoke";

export function InvitationRowActions({
  email,
  id,
}: {
  email: string;
  id: string;
}) {
  const router = useRouter();
  const [action, setAction] = React.useState<Action>();
  const [error, setError] = React.useState<string>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function submit() {
    if (!action) return;
    setError(undefined);
    setIsSubmitting(true);

    try {
      const { error } =
        action === "resend"
          ? await api.api.admin.invitations({ id }).resend.post()
          : await api.api.admin.invitations({ id }).revoke.post();

      if (error) {
        setError(
          (error.value as { message?: string })?.message ||
            `Could not ${action} invitation.`,
        );
        return;
      }

      setAction(undefined);
      router.refresh();
    } catch {
      setError(`Could not ${action} invitation.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open) {
          setAction(undefined);
          setError(undefined);
        }
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for ${email}`}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAction("resend")}>
            <RefreshCw />
            Resend
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setAction("revoke")}
            variant="destructive"
          >
            <XCircle />
            Revoke
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action === "resend" ? "Resend invitation" : "Revoke invitation"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === "resend"
              ? `Invalidate the previous link and email a new invitation to ${email}?`
              : `Revoke the pending invitation for ${email}? Its link will stop working immediately.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            disabled={isSubmitting}
            onClick={() => void submit()}
            type="button"
            variant={action === "revoke" ? "destructive" : "default"}
          >
            {isSubmitting
              ? action === "resend"
                ? "Sending..."
                : "Revoking..."
              : action === "resend"
                ? "Resend invitation"
                : "Revoke invitation"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
