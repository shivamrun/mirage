"use client";

import { KeyRound, Lock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid gap-4">
        <ForcePasswordResetPanel />
        <GlobalSessionRevokePanel activeSessions={summary.activeSessions} />
        <MaintenanceLockoutPanel />
      </div>

      <aside className="h-fit rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-base">Security Snapshot</h2>
        </div>
        <dl className="divide-y">
          <SummaryRow label="Active sessions" value={summary.activeSessions} />
          <SummaryRow label="Stored sessions" value={summary.totalSessions} />
          <SummaryRow label="Active bans" value={summary.activeBans} />
          <SummaryRow label="Banned users" value={summary.bannedUsers} />
        </dl>
      </aside>
    </div>
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
          tone: "error",
        });
        return;
      }

      const body = await response.json();

      setStatus({
        text:
          typeof body.message === "string"
            ? body.message
            : "Password reset was forced.",
        tone: "success",
      });
      setEmail("");
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
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-base">Force Password Reset</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">
          Revoke a user's sessions and send a password reset link.
        </p>
      </div>

      <form onSubmit={onSubmit} className="p-4">
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

          <div className="flex justify-end">
            <Button disabled={isSubmitting} type="submit">
              <KeyRound data-icon="inline-start" />
              {isSubmitting ? "Sending..." : "Force reset"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </section>
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
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-base">Revoke All Sessions</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">
          Sign everyone out across the application.
        </p>
      </div>

      <div className="space-y-4 p-4">
        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <span className="font-medium">{activeSessions}</span>{" "}
          <span className="text-muted-foreground">active sessions now</span>
        </div>

        <div className="flex justify-end">
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
                  This signs out every user, including the current admin
                  session.
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
    </section>
  );
}

function MaintenanceLockoutPanel() {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-base">Maintenance Lockout</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">
          Requires a persisted security settings table before activation.
        </p>
      </div>

      <div className="p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="security-maintenance-message">
              Lockout message
            </FieldLabel>
            <Input
              disabled
              id="security-maintenance-message"
              placeholder="Maintenance is in progress."
            />
            <FieldDescription>
              Add a settings store and auth gate before enabling this action.
            </FieldDescription>
          </Field>

          <div className="flex justify-end">
            <Button disabled type="button" variant="outline">
              <Lock data-icon="inline-start" />
              Enable lockout
            </Button>
          </div>
        </FieldGroup>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
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
