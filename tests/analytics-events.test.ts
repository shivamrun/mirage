import { describe, expect, it, vi } from "vitest";
import { getAnalyticsAttribution } from "@/adapters/analytics/attribution";
import type {
  AnalyticsTrack,
  ServerAuthoritativeEventMap,
  ServerBestEffortEventMap,
} from "@/adapters/analytics/events";
import {
  analyticsAttributionFromMetadata,
  analyticsAttributionToMetadata,
  isValidDistinctId,
} from "@/adapters/analytics/events";

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
  it("keeps the first campaign snapshot when a later URL has other UTM fields", () => {
    const data = new Map<string, string>();
    const browser = {
      location: new URL("https://mirage.test/?utm_source=youtube"),
      sessionStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
      },
    };
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", { referrer: "" });
    try {
      expect(getAnalyticsAttribution()).toEqual({
        landingPath: "/",
        utmSource: "youtube",
      });
      browser.location = new URL(
        "https://mirage.test/register?utm_campaign=launch",
      );
      expect(getAnalyticsAttribution()).toEqual({
        landingPath: "/",
        utmSource: "youtube",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("validates distinct IDs at runtime", () => {
    expect(isValidDistinctId("user_123")).toBe(true);
    expect(isValidDistinctId("")).toBe(false);
    expect(isValidDistinctId("a".repeat(51))).toBe(false);
  });

  it("accepts valid event shapes", () => {
    serverTrack("login_completed");
    serverTrack("subscription_checkout_started", {
      billingInterval: "monthly",
      plan: "pro",
    });
    serverTrack("signup_completed", { attribution: { utmSource: "youtube" } });
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

  it("carries campaign fields through Stripe metadata", () => {
    const metadata = analyticsAttributionToMetadata({
      creator: "demo",
      utmSource: " youtube ",
    });
    expect(metadata).toEqual({
      analytics_creator: "demo",
      analytics_utm_source: "youtube",
    });
    expect(
      analyticsAttributionFromMetadata({ ...metadata, userId: "internal" }),
    ).toEqual({ creator: "demo", utmSource: "youtube" });
  });

  it("keeps invalid examples type-only", () => {
    // @ts-expect-error login_completed does not accept properties.
    serverTrack("login_completed", { plan: "pro" });

    // @ts-expect-error missing required property.
    serverTrack("subscription_checkout_started", {
      billingInterval: "monthly",
    });

    // @ts-expect-error free is not a checkout plan.
    serverTrack("subscription_checkout_started", {
      billingInterval: "monthly",
      plan: "free",
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
