import {
  type BillingSubscriptionRecord,
  getBillingSubscriptionsByUserId,
} from "@/server/db/dal/billing";
import { getCreditBalance } from "@/server/db/services/credits/ledger";

export function getBillingSubscriptionsForUser(userId: string) {
  return getBillingSubscriptionsByUserId(userId);
}

export async function getBillingOverview(userId: string) {
  const [subscriptions, creditBalance] = await Promise.all([
    getBillingSubscriptionsByUserId(userId),
    getCreditBalance(userId),
  ]);
  return { creditBalance, subscriptions };
}

export type { BillingSubscriptionRecord };
