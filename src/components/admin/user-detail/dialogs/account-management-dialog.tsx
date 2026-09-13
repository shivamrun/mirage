"use client";

import { Unlink2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AuthStatusMessage } from "@/components/auth";
import { getUnexpectedAuthErrorMessage } from "@/components/auth/auth-errors";
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
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatProviderName } from "../formatters";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

export type AdminUserLinkedAccount = {
  accountId: string;
  id: string;
  providerId: string;
};

type AdminUserAccountManageDialogProps = {
  account: AdminUserLinkedAccount;
  className?: string;
  userId: string;
};

export function AdminUserAccountManageDialog({
  account,
  className,
  userId,
}: AdminUserAccountManageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const providerName = formatProviderName(account.providerId);
  const isProtected = account.providerId === "credential";

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setStatus(undefined);
  }, [open]);

  async function unlinkAccount() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const { error } = await api.api.admin
        .users({ userId })
        .accounts({ accountRowId: account.id })
        .delete();

      if (error) {
        setStatus({
          text: getEdenMessage(
            error,
            "Could not unlink this account. Please try again.",
          ),
          tone: "error",
        });
        return;
      }

      setOpen(false);
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          aria-haspopup="dialog"
          className={cn("min-w-0 gap-2", className)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Unlink2 className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Remove</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {providerName}</AlertDialogTitle>
          <AlertDialogDescription>
            {isProtected
              ? "Password credential rows stay attached to the user."
              : `Unlink ${providerName} from this user account.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <AccountDetail label="Provider" value={account.providerId} />
          <AccountDetail label="Account ID" value={account.accountId} />
          <AccountDetail label="Row ID" value={account.id} />
        </div>

        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>

          {isProtected ? null : (
            <Button
              disabled={isSubmitting}
              onClick={unlinkAccount}
              type="button"
              variant="destructive"
            >
              <Unlink2 data-icon="inline-start" />
              {isSubmitting ? "Unlinking..." : "Unlink account"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs">{value}</span>
    </div>
  );
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
