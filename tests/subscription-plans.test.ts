import { describe, expect, it } from "vitest";

import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";

describe("subscriptionPlans", () => {
  it("keeps the static subscription plan contract", () => {
    expect(subscriptionPlans).toEqual([
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
    ]);
  });
});
