"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { billingClient } from "@/features/billing-client";

function AccountBillingPortalButton({
  disabled,
  label = "Open billing portal",
  returnPath = "/billing",
  variant = "default",
}: {
  disabled?: boolean;
  label?: string;
  returnPath?: string;
  variant?: "default" | "outline";
}) {
  const [error, setError] = React.useState<string>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const isBusy = isPending || isRedirecting;

  function openBillingPortal() {
    setError(undefined);

    startTransition(async () => {
      try {
        const origin = window.location.origin;
        const result = await billingClient.openPortal({
          disableRedirect: true,
          returnUrl: `${origin}${returnPath}`,
        });

        if (result.error) {
          setError(
            result.error.message || "Billing portal could not be opened.",
          );
          return;
        }

        const portalUrl =
          result.data && "url" in result.data ? result.data.url : undefined;

        if (portalUrl) {
          setIsRedirecting(true);
          window.location.assign(portalUrl);
          return;
        }

        setError("Billing portal did not return a redirect URL.");
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={disabled || isBusy}
        onClick={openBillingPortal}
        type="button"
        variant={variant}
      >
        {isBusy ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <ExternalLink data-icon="inline-start" />
        )}
        {isRedirecting ? "Redirecting..." : label}
      </Button>
      {error ? (
        <p className="text-destructive text-sm leading-6" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { AccountBillingPortalButton };
