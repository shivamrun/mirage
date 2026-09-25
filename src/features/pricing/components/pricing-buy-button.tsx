"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/better-auth/client";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import { getPricingCheckoutPath } from "@/features/pricing/checkout-intent";
import type { BillingInterval, PricingPlanKey } from "@/features/pricing/plans";
import { api } from "@/shared/api/client";

function PricingBuyButton({
  interval,
  isCurrentPlan,
  isAuthenticated,
  plan,
  planName,
  scheduleAtPeriodEnd,
  subscriptionId,
  text,
}: {
  interval: BillingInterval;
  isCurrentPlan?: boolean;
  isAuthenticated: boolean;
  plan: Exclude<PricingPlanKey, "free">;
  planName: string;
  scheduleAtPeriodEnd?: boolean;
  subscriptionId?: null | string;
  text: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const isBusy = isPending || isRedirecting;

  function handleCheckout() {
    setError(undefined);

    if (!isAuthenticated) {
      router.push(
        `/register?${new URLSearchParams({
          callbackURL: getPricingCheckoutPath({ interval, plan }),
        })}`,
      );
      return;
    }

    startTransition(async () => {
      try {
        if (subscriptionId) {
          const origin = window.location.origin;
          const result = await authClient.subscription.upgrade({
            annual: interval === "annual",
            cancelUrl: `${origin}/pricing?checkout=cancelled`,
            disableRedirect: true,
            plan: planName,
            returnUrl: `${origin}/billing?checkout=updated`,
            scheduleAtPeriodEnd,
            subscriptionId,
            successUrl: `${origin}/billing?checkout=success`,
          });

          if (result.error) {
            setError(result.error.message || "Checkout could not be started.");
            return;
          }

          const checkoutUrl =
            result.data && "url" in result.data ? result.data.url : undefined;

          if (checkoutUrl) {
            setIsRedirecting(true);
            window.location.assign(checkoutUrl);
            return;
          }

          router.refresh();
          return;
        }

        const result = await api.api.billing.checkout.post(
          {
            interval: interval === "annual" ? "yearly" : "monthly",
            plan,
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

        setIsRedirecting(true);
        window.location.assign(result.data.url);
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={isCurrentPlan || isBusy}
        onClick={handleCheckout}
        type="button"
      >
        {isBusy ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : null}
        {isCurrentPlan
          ? "Current plan"
          : isRedirecting
            ? "Redirecting..."
            : text}
        {isCurrentPlan || isBusy ? null : <ArrowRight data-icon="inline-end" />}
      </Button>
      {error ? (
        <p className="text-destructive text-sm leading-6" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { PricingBuyButton };
