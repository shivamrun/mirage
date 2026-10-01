"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountDeletionConfirmationPhrase } from "@/shared/schemas";

type ExportStatus = {
  export: null | {
    deliveryDueAt: string;
    requestedAt: string;
    status: string;
  };
};

export function AccountDataExport() {
  const [status, setStatus] = React.useState<ExportStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    const response = await fetch("/api/account/data-export", {
      cache: "no-store",
    });
    if (response.ok) setStatus((await response.json()) as ExportStatus);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function requestExport() {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/account/data-export", {
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "Could not request the data export.");
      }
      toast.success("Your export was requested.");
      await loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not request the data export.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading status…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Request a private archive of your account data. We will prepare it and
        send download instructions within 24 hours.
      </p>
      {status?.export ? (
        <div className="text-sm">
          <p>Status: {status.export.status}</p>
          <p className="text-muted-foreground">
            Delivery due by{" "}
            {new Date(status.export.deliveryDueAt).toLocaleString()}.
          </p>
        </div>
      ) : null}
      <Button
        disabled={
          isSubmitting ||
          Boolean(
            status?.export &&
              ["pending", "processing"].includes(status.export.status),
          )
        }
        onClick={requestExport}
        type="button"
        variant="outline"
      >
        {isSubmitting ? "Requesting…" : "Request data export"}
      </Button>
    </div>
  );
}

export function AccountDeletionDangerZone() {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/account/deletion", {
        body: JSON.stringify({ confirmation, password: password || undefined }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete the account.");
      }
      router.replace("/login?accountDeleted=true");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete the account.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <p className="text-muted-foreground text-sm">
        This immediately signs you out and starts permanent account deletion.
        This cannot be undone. Request and receive a data export first if you
        need a copy.
      </p>
      <div className="space-y-2">
        <Label htmlFor="account-deletion-password">Current password</Label>
        <Input
          autoComplete="current-password"
          id="account-deletion-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Required for password accounts"
          type="password"
          value={password}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-deletion-confirmation">
          Type {accountDeletionConfirmationPhrase} to confirm
        </Label>
        <Input
          autoComplete="off"
          id="account-deletion-confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
      </div>
      <Button
        disabled={
          isSubmitting || confirmation !== accountDeletionConfirmationPhrase
        }
        type="submit"
        variant="destructive"
      >
        {isSubmitting ? "Deleting…" : "Permanently delete account"}
      </Button>
    </form>
  );
}
