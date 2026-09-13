"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  AccountSection,
  AccountSectionStack,
} from "@/components/account/account-section";
import { AuthStatusMessage, EmailField } from "@/components/auth";
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
import { FieldGroup } from "@/components/ui/field";

type SecurityControlSummary = {
  activeBans: number;
  activeSessions: number;
  bannedUsers: number;
  totalSessions: number;
};

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

export function SecurityControls({
  summary,
}: {
  summary: SecurityControlSummary;
}) {
  return (
    <AccountSectionStack>
      <AccountSection
        description="Review the current session and ban counts before taking broader security action."
        title="Security snapshot"
      >
        <dl className="grid gap-3">
          <SummaryRow label="Active sessions" value={summary.activeSessions} />
          <SummaryRow label="Stored sessions" value={summary.totalSessions} />
          <SummaryRow label="Active bans" value={summary.activeBans} />
          <SummaryRow label="Banned users" value={summary.bannedUsers} />
        </dl>
      </AccountSection>

      <AccountSection
        description="Revoke a user's sessions and request a password reset email."
        title="Force password reset"
      >
        <ForcePasswordResetPanel />
      </AccountSection>

      <AccountSection
        description="Sign everyone out across the application, including this admin session."
        title="Revoke all sessions"
      >
        <GlobalSessionRevokePanel activeSessions={summary.activeSessions} />
      </AccountSection>
    </AccountSectionStack>
  );
}

function ForcePasswordResetPanel() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/security/force-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setStatus({
          text: await getResponseMessage(response),
          tone: response.status === 503 ? "info" : "error",
        });
        if (response.status === 503) router.refresh();
        return;
      }

      const body = await response.json();

      setStatus({
        text:
          typeof body.message === "string"
            ? body.message
            : "Sessions were revoked. Password reset email delivery is unconfirmed.",
        tone: "info",
      });
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
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <EmailField
          disabled={isSubmitting}
          id="security-force-reset-email"
          label="User email"
          onChange={(event) => setEmail(event.target.value)}
          required
          value={email}
        />

        <Button className="w-full" disabled={isSubmitting} type="submit">
          <KeyRound data-icon="inline-start" />
          {isSubmitting
            ? "Requesting..."
            : status?.tone === "info"
              ? "Request reset again"
              : "Force reset"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function GlobalSessionRevokePanel({
  activeSessions,
}: {
  activeSessions: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function revokeAllSessions() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/security/revoke-all-sessions", {
        method: "POST",
      });

      if (!response.ok) {
        setStatus({
          text: await getResponseMessage(response),
          tone: "error",
        });
        return;
      }

      const body = await response.json();
      const revokedCount =
        typeof body.revokedSessions === "number" ? body.revokedSessions : 0;

      setStatus({
        text: `Revoked ${revokedCount} sessions. Redirecting to sign in...`,
        tone: "success",
      });
      setOpen(false);
      window.setTimeout(() => {
        window.location.assign("/login");
      }, 900);
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
    <div className="space-y-4">
      {status ? (
        <AuthStatusMessage className="text-left" tone={status.tone}>
          {status.text}
        </AuthStatusMessage>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-medium text-base">{activeSessions}</span>{" "}
          <span className="text-muted-foreground text-sm">
            active sessions now
          </span>
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              <LogOut data-icon="inline-start" />
              Revoke globally
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke every session?</AlertDialogTitle>
              <AlertDialogDescription>
                This signs out every user, including the current admin session.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>

              <Button
                disabled={isSubmitting}
                onClick={revokeAllSessions}
                type="button"
                variant="destructive"
              >
                <LogOut data-icon="inline-start" />
                {isSubmitting ? "Revoking..." : "Revoke sessions"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value.toLocaleString()}</dd>
    </div>
  );
}

async function getResponseMessage(response: Response) {
  try {
    const body = await response.json();

    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return "Security action failed. Please try again.";
}
