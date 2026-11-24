import { beforeEach, describe, expect, it, vi } from "vitest";

const defaultEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_UMAMI_ENABLED: undefined as boolean | undefined,
  NEXT_PUBLIC_UMAMI_BROWSER_ENABLED: undefined as boolean | undefined,
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: "test-website" as string | undefined,
  UMAMI_HOST_URL: "https://gateway.umami.is",
};
const analyticsEnv = { ...defaultEnv };

vi.doMock("@/shared/env", () => ({ env: analyticsEnv }));
const { getAnalyticsConfig, getServerAnalyticsConfig } = await import(
  "@/adapters/analytics/config"
);
vi.doUnmock("@/shared/env");

beforeEach(() => {
  Object.assign(analyticsEnv, defaultEnv);
});

describe("analytics enablement", () => {
  it("keeps server-only tracking when the browser flag is unset", () => {
    expect(getAnalyticsConfig().enabled).toBe(false);
    expect(getServerAnalyticsConfig().enabled).toBe(true);
  });

  it("enables browser tracking with an explicit opt-in", () => {
    analyticsEnv.NEXT_PUBLIC_UMAMI_BROWSER_ENABLED = true;
    expect(getAnalyticsConfig().enabled).toBe(true);

    analyticsEnv.NEXT_PUBLIC_UMAMI_WEBSITE_ID = undefined;
    expect(getAnalyticsConfig().enabled).toBe(false);
  });

  it("honors the shared disable flag even after browser opt-in", () => {
    analyticsEnv.NEXT_PUBLIC_UMAMI_BROWSER_ENABLED = true;
    analyticsEnv.NEXT_PUBLIC_UMAMI_ENABLED = false;
    expect(getAnalyticsConfig().enabled).toBe(false);
    expect(getServerAnalyticsConfig().enabled).toBe(false);
  });

  it("disables both senders in test even when both flags are true", () => {
    analyticsEnv.NODE_ENV = "test";
    analyticsEnv.NEXT_PUBLIC_UMAMI_BROWSER_ENABLED = true;
    analyticsEnv.NEXT_PUBLIC_UMAMI_ENABLED = true;
    expect(getAnalyticsConfig().enabled).toBe(false);
    expect(getServerAnalyticsConfig().enabled).toBe(false);
  });
});
