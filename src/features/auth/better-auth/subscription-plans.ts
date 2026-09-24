import type { StripePlan } from "@better-auth/stripe";

export const subscriptionPlans = [
  {
    name: "Free",
    limits: {
      plan: "free",
    },
  },
  {
    name: "Pro",
    lookupKey: "mirage_pro_2_monthly",
    annualDiscountLookupKey: "mirage_pro_2_yearly",
    limits: {
      plan: "pro",
    },
  },
] satisfies StripePlan[];
