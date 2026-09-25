import type { StripePlan } from "@better-auth/stripe";

import { billingCatalog } from "@/server/db/services/billing/catalog";

export const subscriptionPlans = [
  {
    name: "Free",
    limits: {
      credits: 10,
      plan: "free",
    },
  },
  {
    name: billingCatalog.subscriptions.pro.displayName,
    lookupKey: billingCatalog.subscriptions.pro.prices.monthly.lookupKey,
    annualDiscountLookupKey:
      billingCatalog.subscriptions.pro.prices.yearly.lookupKey,
    prorationBehavior: "always_invoice",
    limits: {
      credits: billingCatalog.subscriptions.pro.credits,
      plan: "pro",
    },
  },
  {
    name: billingCatalog.subscriptions.hacker.displayName,
    lookupKey: billingCatalog.subscriptions.hacker.prices.monthly.lookupKey,
    annualDiscountLookupKey:
      billingCatalog.subscriptions.hacker.prices.yearly.lookupKey,
    prorationBehavior: "always_invoice",
    limits: {
      credits: billingCatalog.subscriptions.hacker.credits,
      plan: "hacker",
    },
  },
] satisfies StripePlan[];
