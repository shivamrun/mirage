import { describe, expect, it } from "vitest";

import { POST } from "@/app/(backend)/api/auth/[...all]/route";

describe("Stripe webhook route", () => {
  it("is mounted through the Better Auth handler", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/stripe/webhook", {
        body: "{}",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "STRIPE_SIGNATURE_NOT_FOUND",
    });
  });
});
