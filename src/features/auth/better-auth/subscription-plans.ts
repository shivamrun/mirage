import type { StripePlan } from "@better-auth/stripe";

export const subscriptionPlans = [
  {
    name: "Free",
    limits: {
      plan: "free",
    },
  },
  {
    name: "Mirage Pro",
    lookupKey: "mirage_pro_2_monthly",
    annualDiscountLookupKey: "mirage_pro_2_yearly",
    prorationBehavior: "always_invoice",
    limits: {
      plan: "pro",
    },
  },
  {
    name: "Mirage Hacker",
    lookupKey: "mirage_hacker_monthly",
    annualDiscountLookupKey: "mirage_hacker_yearly",
    prorationBehavior: "always_invoice",
    limits: {
      plan: "hacker",
    },
  },
] satisfies StripePlan[];
