"use client";

import { CreditCard, Loader2 } from "lucide-react";
import * as React from "react";

import { getAnalyticsAttribution } from "@/adapters/analytics/attribution";
import { Button } from "@/components/ui/button";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { api } from "@/shared/api/client";

function AccountCreditTopUpButton() {
  const [error, setError] = React.useState<string>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const isBusy = isPending || isRedirecting;

  function handleTopUp() {
    setError(undefined);

    startTransition(async () => {
      try {
        const response = await api.api.billing.checkout.post(
          {
            attribution: getAnalyticsAttribution(),
            type: "credit_top_up",
          },
          {
            headers: {
              "content-type": "application/json",
            },
          },
        );

        if (response.error) {
          setError(
            response.error.value.message ||
              "Billing checkout could not be started.",
          );
          return;
        }

        setIsRedirecting(true);
        window.location.assign(response.data.url);
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button disabled={isBusy} onClick={handleTopUp} type="button">
        {isBusy ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <CreditCard data-icon="inline-start" />
        )}
        {isRedirecting ? "Redirecting..." : "Buy 200 credits"}
      </Button>
      {error ? (
        <p className="text-destructive text-sm leading-6" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { AccountCreditTopUpButton };
