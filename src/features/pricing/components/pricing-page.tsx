"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PricingBuyButton } from "@/features/pricing/components/pricing-buy-button";
import {
  type BillingInterval,
  billingIntervalLabels,
  billingIntervalRank,
  type PricingPlanKey,
  pricingPlanRank,
  pricingPlans,
} from "@/features/pricing/plans";

function shouldSchedulePlanChangeAtPeriodEnd({
  currentInterval,
  currentPlan,
  interval,
  plan,
}: {
  currentInterval?: BillingInterval;
  currentPlan: PricingPlanKey;
  interval: BillingInterval;
  plan: PricingPlanKey;
}) {
  // TODO: Add an explicit immediate-downgrade flow with Stripe credit/refund copy.
  if (pricingPlanRank[plan] < pricingPlanRank[currentPlan]) {
    return true;
  }

  if (
    plan === currentPlan &&
    currentInterval &&
    billingIntervalRank[interval] < billingIntervalRank[currentInterval]
  ) {
    return true;
  }

  return false;
}

function PricingPage({
  currentInterval,
  currentPlan = "free",
  isAuthenticated,
  subscriptionId,
}: {
  currentInterval?: BillingInterval;
  currentPlan?: PricingPlanKey;
  isAuthenticated: boolean;
  subscriptionId?: null | string;
}) {
  const [interval, setInterval] = React.useState<BillingInterval>(
    currentInterval ?? "monthly",
  );

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-4">
          <p className="font-medium text-primary text-sm uppercase">Pricing</p>
          <h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
            Pick the plan that matches your moment.
          </h1>
          <p className="text-lg text-muted-foreground leading-8">
            Start free, then upgrade to Pro when you are ready for the paid
            workspace. Stripe handles the final checkout price for each billing
            interval.
          </p>
        </div>

        <ToggleGroup
          aria-label="Billing interval"
          className="rounded-lg border border-border bg-muted p-1"
          onValueChange={(value) => {
            if (value === "monthly" || value === "annual") {
              setInterval(value);
            }
          }}
          spacing={0}
          type="single"
          value={interval}
        >
          {(["monthly", "annual"] as const).map((value) => (
            <ToggleGroupItem
              className="min-w-24 data-[state=on]:bg-background data-[state=on]:shadow-sm"
              key={value}
              value={value}
            >
              {billingIntervalLabels[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pricingPlans.map((plan) => {
          const Icon = plan.icon;
          const isPaid = plan.key !== "free";
          const isCurrentPlan =
            currentPlan === plan.key &&
            (!isPaid || !currentInterval || currentInterval === interval);

          return (
            <article
              className="flex min-h-[31rem] flex-col rounded-lg border border-border bg-card p-6"
              key={plan.key}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-primary text-sm">
                    {plan.eyebrow}
                  </p>
                  <h2 className="mt-2 font-semibold text-2xl">{plan.name}</h2>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
              </div>

              <p className="mt-4 text-muted-foreground leading-7">
                {plan.description}
              </p>

              <div className="mt-6 border-border border-y py-6">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-semibold text-3xl">
                    {plan.price[interval]}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {plan.priceSuffix}
                  </span>
                </div>
              </div>

              <ul className="mt-6 grid gap-3 text-sm">
                {plan.features.map((feature) => (
                  <li className="flex gap-3" key={feature}>
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground leading-6">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                {isPaid ? (
                  <PricingBuyButton
                    interval={interval}
                    isCurrentPlan={isCurrentPlan}
                    isAuthenticated={isAuthenticated}
                    planName={plan.checkoutPlanName}
                    scheduleAtPeriodEnd={shouldSchedulePlanChangeAtPeriodEnd({
                      currentInterval,
                      currentPlan,
                      interval,
                      plan: plan.key,
                    })}
                    subscriptionId={subscriptionId}
                    text={plan.cta}
                  />
                ) : (
                  <Button
                    asChild={!isCurrentPlan}
                    className="w-full"
                    disabled={isCurrentPlan}
                    variant="outline"
                  >
                    {isCurrentPlan ? (
                      <span>Current plan</span>
                    ) : (
                      <Link href={isAuthenticated ? "/account" : "/register"}>
                        {isAuthenticated ? "Open account" : plan.cta}
                      </Link>
                    )}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export { PricingPage };
