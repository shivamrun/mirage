import Script from "next/script";
import { getAnalyticsConfig } from "@/adapters/analytics/config";
import { env } from "@/shared/env";

export function UmamiAnalyticsScript() {
  const config = getAnalyticsConfig();

  if (!config.enabled || !config.websiteId) {
    return null;
  }

  return (
    <Script
      data-domains={config.domains}
      data-exclude-search="true"
      data-host-url={new URL(env.NEXT_PUBLIC_BASE_URL).origin}
      data-website-id={config.websiteId}
      defer
      src="/stats.js"
      strategy="afterInteractive"
    />
  );
}
