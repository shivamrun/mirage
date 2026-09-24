import { describe, expect, it } from "vitest";

import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";

describe("subscriptionPlans", () => {
  it("keeps the static Free and Pro plan contract", () => {
    expect(subscriptionPlans).toEqual([
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
    ]);
  });
});
