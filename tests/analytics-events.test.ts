import { describe, expect, it } from "vitest";
import type {
  AnalyticsTrack,
  ClientAnalyticsEventMap,
  ServerAuthoritativeEventMap,
  ServerBestEffortEventMap,
} from "@/adapters/analytics/events";
import { isValidDistinctId } from "@/adapters/analytics/events";

const clientTrack = (() => undefined) as AnalyticsTrack<
  ClientAnalyticsEventMap,
  void
>;
const serverTrack = (() => undefined) as AnalyticsTrack<
  ServerBestEffortEventMap,
  void,
  { context?: { distinctId?: string } }
>;
const authoritativeTrack = (() => undefined) as AnalyticsTrack<
  ServerAuthoritativeEventMap,
  void,
  { context?: { distinctId?: string } }
>;

describe("analytics event types", () => {
  it("validates distinct IDs at runtime", () => {
    expect(isValidDistinctId("user_123")).toBe(true);
    expect(isValidDistinctId("")).toBe(false);
    expect(isValidDistinctId("a".repeat(51))).toBe(false);
  });

  it("accepts valid event shapes", () => {
    clientTrack("login_completed");
    clientTrack("subscription_checkout_started", {
      billingInterval: "monthly",
      plan: "pro",
      scheduleAtPeriodEnd: false,
    });
    serverTrack("signup_completed");
    authoritativeTrack("credits_purchased", {
      credits: 200,
      currency: "USD",
      revenue: 50,
    });
    authoritativeTrack("subscription_started", {
      billingInterval: "monthly",
      plan: "pro",
    });
    authoritativeTrack("subscription_started", {
      billingInterval: "yearly",
      currency: "USD",
      plan: "hacker",
      revenue: 300,
    });
  });

  it("keeps invalid examples type-only", () => {
    // @ts-expect-error server-only event cannot be emitted by the client source.
    clientTrack("signup_completed");

    // @ts-expect-error login_completed does not accept properties.
    clientTrack("login_completed", {});

    // @ts-expect-error missing required property.
    clientTrack("subscription_checkout_started", {
      billingInterval: "monthly",
      plan: "pro",
    });

    // @ts-expect-error free is not a checkout plan.
    clientTrack("subscription_checkout_started", {
      billingInterval: "monthly",
      plan: "free",
      scheduleAtPeriodEnd: false,
    });

    // @ts-expect-error inline extra fields are rejected.
    serverTrack("credits_consumed", {
      credits: 10,
      extra: true,
      itemKey: "tiny-note",
      source: "sample_credit_lab",
    });

    const typedProps = {
      credits: 10,
      extra: true,
      itemKey: "tiny-note",
      source: "sample_credit_lab",
    } as const;
    // @ts-expect-error typed variables with extra fields are rejected.
    serverTrack("credits_consumed", typedProps);

    // @ts-expect-error revenue requires currency.
    authoritativeTrack("subscription_started", {
      billingInterval: "monthly",
      plan: "pro",
      revenue: 10,
    });

    // @ts-expect-error currency requires revenue.
    authoritativeTrack("subscription_started", {
      billingInterval: "monthly",
      currency: "USD",
      plan: "pro",
    });
  });
});
