import type { StripePlan } from "@better-auth/stripe";

export const subscriptionPlans = [
  {
    name: "Free",
    limits: {
      credits: 10,
      plan: "free",
    },
  },
  {
    name: "Mirage Pro",
    lookupKey: "mirage_pro_2_monthly",
    annualDiscountLookupKey: "mirage_pro_2_yearly",
    prorationBehavior: "always_invoice",
    limits: {
      credits: 50,
      plan: "pro",
    },
  },
  {
    name: "Mirage Hacker",
    lookupKey: "mirage_hacker_monthly",
    annualDiscountLookupKey: "mirage_hacker_yearly",
    prorationBehavior: "always_invoice",
    limits: {
      credits: 100,
      plan: "hacker",
    },
  },
] satisfies StripePlan[];
