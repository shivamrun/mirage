import {
  type BillingInterval,
  type PricingPlanKey,
  pricingPlans,
} from "@/features/pricing/plans";

const checkoutPath = "/checkout";

const paidPricingPlans = pricingPlans.filter(
  (
    plan,
  ): plan is (typeof pricingPlans)[number] & {
    checkoutPlanName: string;
    key: Exclude<PricingPlanKey, "free">;
  } => plan.key !== "free" && Boolean(plan.checkoutPlanName),
);

const checkoutPlanNamesByKey = new Map(
  paidPricingPlans.map((plan) => [plan.key, plan.checkoutPlanName]),
);

function isBillingInterval(value?: string): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

function isPaidPricingPlanKey(
  value?: string,
): value is Exclude<PricingPlanKey, "free"> {
  return value === "pro" || value === "hacker";
}

export function getPricingCheckoutPath({
  interval,
  plan,
}: {
  interval: BillingInterval;
  plan: Exclude<PricingPlanKey, "free">;
}) {
  return `${checkoutPath}?${new URLSearchParams({
    interval,
    plan,
  })}`;
}

export function getCheckoutIntent(searchParams: {
  interval?: string;
  plan?: string;
}) {
  if (
    !isPaidPricingPlanKey(searchParams.plan) ||
    !isBillingInterval(searchParams.interval)
  ) {
    return null;
  }

  const checkoutPlanName = checkoutPlanNamesByKey.get(searchParams.plan);

  if (!checkoutPlanName) {
    return null;
  }

  return {
    interval: searchParams.interval,
    plan: searchParams.plan,
    planName: checkoutPlanName,
  };
}
