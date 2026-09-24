import { describe, expect, it } from "vitest";

import { pricingPlans } from "@/features/pricing/plans";

describe("pricingPlans", () => {
  it("keeps the static credit allowances visible to pricing surfaces", () => {
    expect(
      pricingPlans.map(({ credits, key }) => ({
        credits,
        key,
      })),
    ).toEqual([
      {
        credits: 10,
        key: "free",
      },
      {
        credits: 50,
        key: "pro",
      },
      {
        credits: 100,
        key: "hacker",
      },
    ]);
  });
});
