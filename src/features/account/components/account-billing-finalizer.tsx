"use client";

import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  clearStartedBillingCheckoutSnapshot,
  readStartedBillingCheckoutSnapshot,
} from "@/features/account/billing-finalization";
import { api } from "@/shared/api/client";

const POLL_DELAY_MS = 1500;
const MAX_ATTEMPTS = 8;

function AccountBillingFinalizer({
  checkoutStatus,
  snapshotKey,
}: {
  checkoutStatus?: string;
  snapshotKey: string;
}) {
  const router = useRouter();
  const [startedSnapshotKey, setStartedSnapshotKey] = React.useState<
    string | null
  >(null);
  const [attempts, setAttempts] = React.useState(0);
  const [state, setState] = React.useState<"complete" | "finalizing" | "slow">(
    "finalizing",
  );
  const shouldFinalize = checkoutStatus === "credit_top_up_success";

  React.useEffect(() => {
    setStartedSnapshotKey(readStartedBillingCheckoutSnapshot());
  }, []);

  React.useEffect(() => {
    if (checkoutStatus && !shouldFinalize) {
      clearStartedBillingCheckoutSnapshot();
    }
  }, [checkoutStatus, shouldFinalize]);

  React.useEffect(() => {
    if (!shouldFinalize || state === "complete") {
      return;
    }

    if (
      startedSnapshotKey &&
      snapshotKey !== startedSnapshotKey
    ) {
      clearStartedBillingCheckoutSnapshot();
      setState("complete");
      const timeout = window.setTimeout(() => {
        router.replace("/billing", { scroll: false });
      }, 1800);

      return () => window.clearTimeout(timeout);
    }
  }, [router, shouldFinalize, snapshotKey, startedSnapshotKey, state]);

  React.useEffect(() => {
    if (
      !shouldFinalize ||
      state !== "finalizing" ||
      !startedSnapshotKey
    ) {
      return;
    }

    let cancelled = false;

    async function pollBillingState() {
      if (attempts >= MAX_ATTEMPTS) {
        setState("slow");
        return;
      }

      await api.api.credits.balance.get().catch(() => null);

      if (cancelled) {
        return;
      }

      router.refresh();
      setAttempts((currentAttempts) => currentAttempts + 1);
    }

    const timeout = window.setTimeout(pollBillingState, POLL_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [attempts, router, shouldFinalize, startedSnapshotKey, state]);

  if (!shouldFinalize || !startedSnapshotKey) {
    return null;
  }

  if (state === "complete") {
    return (
      <aside
        aria-live="polite"
        className="flex items-start gap-3 border-border border-y bg-primary/5 px-6 py-4 text-sm"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Billing updated</p>
          <p className="mt-1 text-muted-foreground">
            Your latest credits and plan are now showing.
          </p>
        </div>
      </aside>
    );
  }

  if (state === "slow") {
    return (
      <aside
        aria-live="polite"
        className="flex flex-col gap-3 border-border border-y bg-muted/40 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-medium">Billing is still syncing</p>
          <p className="mt-1 text-muted-foreground">
            Stripe confirmed checkout, but the account update is taking longer
            than usual.
          </p>
        </div>
        <Button
          onClick={() => router.refresh()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </aside>
    );
  }

  return (
    <aside
      aria-live="polite"
      className="flex items-start gap-3 border-border border-y bg-muted/40 px-6 py-4 text-sm"
    >
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      <div>
        <p className="font-medium">Finalizing billing</p>
        <p className="mt-1 text-muted-foreground">
          Stripe confirmed checkout. Your credits and plan should update here in
          a moment.
        </p>
      </div>
    </aside>
  );
}

export { AccountBillingFinalizer };
