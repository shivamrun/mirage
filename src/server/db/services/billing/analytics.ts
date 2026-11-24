import { getServerAnalyticsConfig } from "@/adapters/analytics/config";
import type { BillingAnalyticsEvent } from "@/adapters/analytics/events";
import { deliverBillingAnalytics } from "@/adapters/analytics/server";
import {
  claimBillingAnalytics,
  completeBillingAnalytics,
  insertBillingAnalytics,
} from "@/server/db/dal/billing-analytics";

export async function queueBillingAnalytics(
  key: string,
  event: BillingAnalyticsEvent,
  occurredAt: Date,
) {
  if (!getServerAnalyticsConfig().enabled) return;
  await insertBillingAnalytics(key, event, occurredAt);
}

export async function drainBillingAnalytics() {
  if (!getServerAnalyticsConfig().enabled) return;
  for (let index = 0; index < 20; index += 1) {
    const claim = await claimBillingAnalytics();
    if (!claim) return;
    const delivered = await deliverBillingAnalytics(
      claim.event,
      claim.occurredAt,
    );
    await completeBillingAnalytics(claim, delivered);
  }
}

export function startBillingAnalyticsWorker() {
  if (!getServerAnalyticsConfig().enabled) return;

  async function run() {
    try {
      await drainBillingAnalytics();
    } catch (error) {
      console.error("Billing analytics worker failed:", error);
    } finally {
      setTimeout(run, 15_000).unref();
    }
  }

  void run();
}
