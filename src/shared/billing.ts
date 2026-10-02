export const billingCatalog = {
  plans: {
    free: { credits: 10, displayName: "Free", rank: 0 },
    pro: {
      checkoutName: "Mirage Pro",
      credits: 50,
      displayName: "Pro",
      prices: {
        monthly: {
          displayPrice: "$10",
          stripeInterval: "month",
          lookupKey: "mirage_pro_2_monthly",
        },
        annual: {
          displayPrice: "$100",
          stripeInterval: "year",
          lookupKey: "mirage_pro_2_yearly",
        },
      },
      rank: 1,
    },
    hacker: {
      checkoutName: "Mirage Hacker",
      credits: 100,
      displayName: "Mirage Hacker",
      prices: {
        monthly: {
          displayPrice: "$30",
          stripeInterval: "month",
          lookupKey: "mirage_hacker_monthly",
        },
        annual: {
          displayPrice: "$300",
          stripeInterval: "year",
          lookupKey: "mirage_hacker_yearly",
        },
      },
      rank: 2,
    },
  },
  creditTopUp: {
    amount: 5000,
    credits: 200,
    currency: "usd",
    key: "standard",
    lookupKey: "one_time_credit",
  },
} as const;

export type BillingInterval = "monthly" | "annual";
export type BillingPlanKey = keyof typeof billingCatalog.plans;
export type PaidBillingPlanKey = Exclude<BillingPlanKey, "free">;
export type BillingCheckoutInterval = "monthly" | "yearly";
export type BillingCheckoutPlan = PaidBillingPlanKey;

export const paidBillingPlanKeys = ["pro", "hacker"] as const;

export function normalizeBillingPlan(value?: null | string) {
  const normalized = value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  for (const key of Object.keys(billingCatalog.plans) as BillingPlanKey[]) {
    const plan = billingCatalog.plans[key];
    if (
      normalized === key ||
      normalized === plan.displayName.toLowerCase() ||
      ("checkoutName" in plan && normalized === plan.checkoutName.toLowerCase())
    ) {
      return key;
    }
  }

  return null;
}

export function normalizeBillingInterval(value?: null | string) {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "month" || normalized === "monthly") return "monthly";
  if (
    normalized === "year" ||
    normalized === "yearly" ||
    normalized === "annual"
  ) {
    return "annual";
  }
  return null;
}

export function getBillingPlanByLookupKey(lookupKey?: null | string) {
  if (!lookupKey) return null;

  for (const key of paidBillingPlanKeys) {
    const plan = billingCatalog.plans[key];
    for (const interval of ["monthly", "annual"] as const) {
      const price = plan.prices[interval];
      if (price.lookupKey === lookupKey) return { interval, key, plan, price };
    }
  }

  return null;
}

export function getBillingPlanDisplayName(value?: null | string) {
  const key = normalizeBillingPlan(value);
  return key ? billingCatalog.plans[key].displayName : (value ?? null);
}

export function billingPlansMatch(
  first?: null | string,
  second?: null | string,
) {
  const firstKey = normalizeBillingPlan(first);
  const secondKey = normalizeBillingPlan(second);
  return firstKey !== null && firstKey === secondKey;
}

export function getBillingPlanCredits(value?: null | string) {
  const key = normalizeBillingPlan(value);
  return key ? billingCatalog.plans[key].credits : 0;
}

export function shouldScheduleSubscriptionChange({
  currentInterval,
  currentPlan,
  interval,
  plan,
}: {
  currentInterval?: BillingInterval;
  currentPlan: BillingPlanKey;
  interval: BillingInterval;
  plan: BillingPlanKey;
}) {
  if (
    billingCatalog.plans[plan].rank < billingCatalog.plans[currentPlan].rank
  ) {
    return true;
  }

  return (
    plan === currentPlan &&
    currentInterval === "annual" &&
    interval === "monthly"
  );
}
