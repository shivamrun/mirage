"use client";

import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { billingClient } from "@/features/billing-client";

function AccountBillingActions({
  canCancel,
  canRestore,
  subscriptionId,
}: {
  canCancel: boolean;
  canRestore: boolean;
  subscriptionId?: null | string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [redirectingAction, setRedirectingAction] = React.useState<
    "cancel" | undefined
  >();
  const [pendingAction, setPendingAction] = React.useState<
    "cancel" | "restore" | undefined
  >();

  function cancelSubscription() {
    if (!subscriptionId) {
      return;
    }

    setError(undefined);
    setPendingAction("cancel");

    React.startTransition(async () => {
      try {
        const origin = window.location.origin;
        const result = await billingClient.cancelSubscription({
          disableRedirect: true,
          returnUrl: `${origin}/billing?subscription=cancelled`,
          subscriptionId,
        });

        if (result.error) {
          setError(
            result.error.message || "Cancellation could not be started.",
          );
          return;
        }

        const cancelUrl =
          result.data && "url" in result.data ? result.data.url : undefined;

        if (cancelUrl) {
          setRedirectingAction("cancel");
          window.location.assign(cancelUrl);
          return;
        }

        router.refresh();
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      } finally {
        setPendingAction(undefined);
      }
    });
  }

  function restoreSubscription() {
    if (!subscriptionId) {
      return;
    }

    setError(undefined);
    setPendingAction("restore");

    React.startTransition(async () => {
      try {
        const result = await billingClient.restoreSubscription({
          subscriptionId,
        });

        if (result.error) {
          setError(
            result.error.message || "Subscription could not be restored.",
          );
          return;
        }

        router.refresh();
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      } finally {
        setPendingAction(undefined);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canRestore ? (
          <Button
            disabled={pendingAction === "restore"}
            onClick={restoreSubscription}
            type="button"
            variant="outline"
          >
            {pendingAction === "restore" ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            Restore subscription
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            disabled={
              pendingAction === "cancel" || redirectingAction === "cancel"
            }
            onClick={cancelSubscription}
            type="button"
            variant="destructive"
          >
            {pendingAction === "cancel" || redirectingAction === "cancel" ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <XCircle data-icon="inline-start" />
            )}
            {redirectingAction === "cancel" ? "Redirecting..." : "Cancel plan"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm leading-6" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { AccountBillingActions };
