import Script from "next/script";
import { getAnalyticsConfig } from "@/adapters/analytics/config";

export function UmamiAnalyticsScript() {
  const config = getAnalyticsConfig();

  if (!config.enabled || !config.scriptUrl || !config.websiteId) {
    return null;
  }

  return (
    <Script
      data-domains={config.domains}
      data-exclude-search="true"
      data-website-id={config.websiteId}
      defer
      src={config.scriptUrl}
      strategy="afterInteractive"
    />
  );
}
