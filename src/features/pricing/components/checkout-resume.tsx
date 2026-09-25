"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import type { BillingInterval, PricingPlanKey } from "@/features/pricing/plans";
import { pricingPlans } from "@/features/pricing/plans";
import { api } from "@/shared/api/client";

function CheckoutResume({
  interval,
  planName,
}: {
  interval: BillingInterval;
  planName: string;
}) {
  const [error, setError] = React.useState<string>();
  const hasStartedCheckout = React.useRef(false);
  const planKey = pricingPlans.find(
    (plan) => "checkoutPlanName" in plan && plan.checkoutPlanName === planName,
  )?.key;

  React.useEffect(() => {
    if (hasStartedCheckout.current) {
      return;
    }

    hasStartedCheckout.current = true;

    async function startCheckout() {
      try {
        if (!planKey || planKey === "free") {
          setError("Choose a paid plan to continue checkout.");
          return;
        }

        const result = await api.api.billing.checkout.post(
          {
            interval: interval === "annual" ? "yearly" : "monthly",
            plan: planKey as Exclude<PricingPlanKey, "free">,
            type: "subscription",
          },
          {
            headers: {
              "content-type": "application/json",
            },
          },
        );

        if (result.error) {
          setError(
            result.error.value.message || "Checkout could not be started.",
          );
          return;
        }

        window.location.assign(result.data.url);
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      }
    }

    void startCheckout();
  }, [interval, planKey]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      {error ? (
        <>
          <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl">Checkout needs a retry</h1>
            <p className="text-muted-foreground leading-7">{error}</p>
          </div>
          <Button asChild>
            <Link href="/pricing">Back to pricing</Link>
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl">Opening checkout</h1>
            <p className="text-muted-foreground leading-7">
              Hang tight while Stripe prepares your secure checkout page.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export { CheckoutResume };
