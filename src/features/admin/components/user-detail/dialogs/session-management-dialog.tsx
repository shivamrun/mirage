"use client";

import { LogOut, XCircle } from "lucide-react";
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
import { api } from "@/shared/api/client";
import { cn } from "@/shared/utils";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

export type AdminUserManagedSession = {
  createdAt: string;
  expiresAt: string;
  id: string;
  impersonatedBy: null | string;
  ipAddress: null | string;
  userAgent: null | string;
};

type AdminUserSessionManageDialogProps = {
  className?: string;
  session: AdminUserManagedSession;
  userId: string;
};

type AdminUserSessionsRevokeDialogProps = {
  className?: string;
  sessionCount: number;
  userId: string;
};

export function AdminUserSessionsRevokeDialog({
  className,
  sessionCount,
  userId,
}: AdminUserSessionsRevokeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function revokeSessions() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.admin.revokeUserSessions({
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
          disabled={sessionCount === 0}
          size="sm"
          type="button"
          variant="outline"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Revoke all</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke all sessions</AlertDialogTitle>
          <AlertDialogDescription>
            Revoke every session for this user and require them to sign in
            again.
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
            onClick={revokeSessions}
            type="button"
            variant="destructive"
          >
            <LogOut data-icon="inline-start" />
            {isSubmitting ? "Revoking..." : "Revoke sessions"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserSessionManageDialog({
  className,
  session,
  userId,
}: AdminUserSessionManageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setStatus(undefined);
  }, [open]);

  async function revokeSession() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const { error } = await api.api.admin
        .users({ userId })
        .sessions({ sessionId: session.id })
        .delete();

      if (error) {
        setStatus({
          text: getEdenMessage(
            error,
            "Could not revoke this session. Please try again.",
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
          <XCircle className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Remove</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove session</AlertDialogTitle>
          <AlertDialogDescription>
            Revoke this active session and require the user to sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <SessionDetail label="Session ID" value={session.id} />
          <SessionDetail label="Created" value={session.createdAt} />
          <SessionDetail label="Expires" value={session.expiresAt} />
          <SessionDetail label="IP address" value={session.ipAddress ?? "-"} />
          <SessionDetail label="User agent" value={session.userAgent ?? "-"} />
          {session.impersonatedBy ? (
            <SessionDetail
              label="Impersonated by"
              value={session.impersonatedBy}
            />
          ) : null}
        </div>

        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>

          <Button
            disabled={isSubmitting}
            onClick={revokeSession}
            type="button"
            variant="destructive"
          >
            <XCircle data-icon="inline-start" />
            {isSubmitting ? "Revoking..." : "Revoke session"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SessionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-mono text-xs">{value}</span>
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
