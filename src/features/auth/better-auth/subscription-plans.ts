import type { StripePlan } from "@better-auth/stripe";

import { billingCatalog } from "@/shared/billing";

export const subscriptionPlans = [
  {
    name: "Free",
    limits: {
      credits: billingCatalog.plans.free.credits,
      plan: "free",
    },
  },
  {
    name: billingCatalog.plans.pro.checkoutName,
    lookupKey: billingCatalog.plans.pro.prices.monthly.lookupKey,
    annualDiscountLookupKey: billingCatalog.plans.pro.prices.annual.lookupKey,
    prorationBehavior: "always_invoice",
    limits: {
      credits: billingCatalog.plans.pro.credits,
      plan: "pro",
    },
  },
  {
    name: billingCatalog.plans.hacker.checkoutName,
    lookupKey: billingCatalog.plans.hacker.prices.monthly.lookupKey,
    annualDiscountLookupKey:
      billingCatalog.plans.hacker.prices.annual.lookupKey,
    prorationBehavior: "always_invoice",
    limits: {
      credits: billingCatalog.plans.hacker.credits,
      plan: "hacker",
    },
  },
] satisfies StripePlan[];
