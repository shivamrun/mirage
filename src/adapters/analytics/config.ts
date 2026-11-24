import { env } from "@/shared/env";

export type AnalyticsConfig = {
  domains?: string;
  enabled: boolean;
  hostUrl?: string;
  websiteId?: string;
};

function isExplicitlyEnabled(value: boolean | undefined) {
  if (value !== undefined) {
    return value;
  }

  return env.NODE_ENV === "production";
}

function isAnalyticsEnabledForEnvironment() {
  return (
    env.NODE_ENV !== "test" &&
    isExplicitlyEnabled(env.NEXT_PUBLIC_UMAMI_ENABLED)
  );
}

export function getAnalyticsConfig(): AnalyticsConfig {
  const enabled =
    isAnalyticsEnabledForEnvironment() &&
    env.NEXT_PUBLIC_UMAMI_BROWSER_ENABLED === true &&
    Boolean(env.NEXT_PUBLIC_UMAMI_WEBSITE_ID);

  return {
    domains: env.NEXT_PUBLIC_UMAMI_DOMAINS,
    enabled,
    hostUrl: env.UMAMI_HOST_URL,
    websiteId: env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  };
}

export function getServerAnalyticsConfig(): AnalyticsConfig {
  const config = getAnalyticsConfig();

  return {
    ...config,
    enabled:
      isAnalyticsEnabledForEnvironment() &&
      Boolean(config.hostUrl && config.websiteId),
  };
}
