"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/better-auth/client";
import { getUnexpectedAuthErrorMessage } from "@/features/auth/components/auth-errors";
import type { BillingInterval } from "@/features/pricing/plans";

function PricingBuyButton({
  interval,
  isCurrentPlan,
  isAuthenticated,
  planName,
  text,
}: {
  interval: BillingInterval;
  isCurrentPlan?: boolean;
  isAuthenticated: boolean;
  planName: string;
  text: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string>();
  const [isPending, startTransition] = React.useTransition();

  function handleCheckout() {
    setError(undefined);

    if (!isAuthenticated) {
      router.push("/register?callbackURL=/pricing");
      return;
    }

    startTransition(async () => {
      try {
        const origin = window.location.origin;
        const result = await authClient.subscription.upgrade({
          annual: interval === "annual",
          cancelUrl: `${origin}/pricing?checkout=cancelled`,
          disableRedirect: true,
          plan: planName,
          returnUrl: `${origin}/billing?checkout=updated`,
          successUrl: `${origin}/account?checkout=success`,
        });

        if (result.error) {
          setError(result.error.message || "Checkout could not be started.");
          return;
        }

        const checkoutUrl =
          result.data && "url" in result.data ? result.data.url : undefined;

        if (checkoutUrl) {
          window.location.assign(checkoutUrl);
          return;
        }

        router.refresh();
      } catch (reason) {
        setError(getUnexpectedAuthErrorMessage(reason));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={isCurrentPlan || isPending}
        onClick={handleCheckout}
        type="button"
      >
        {isPending ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : null}
        {isCurrentPlan ? "Current plan" : text}
        {isCurrentPlan ? null : <ArrowRight data-icon="inline-end" />}
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
