export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getAnalyticsConfig } = await import("@/adapters/analytics/config");
  const analytics = getAnalyticsConfig();
  if (analytics.enabled && !analytics.hostUrl) {
    console.warn(
      "UMAMI_HOST_URL is missing. Login, checkout, and other server analytics events are disabled.",
    );
  }
  const { startBillingAnalyticsWorker } = await import(
    "@/server/db/services/billing/analytics"
  );
  startBillingAnalyticsWorker();
}
