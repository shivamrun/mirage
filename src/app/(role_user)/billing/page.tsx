import { AccountBillingPage } from "@/features/account/components";
import { getBillingSubscriptionsByUserId } from "@/server/db/dal/billing";
import { requireAuth } from "@/server/db/services/auth/access";
import {
  getBillingTransactions,
  syncBillingSubscriptionsFromStripe,
} from "@/server/db/services/billing/stripe-subscriptions";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Billing", {
  path: "/billing",
});

const activeStatuses = new Set(["active", "trialing"]);

export default async function Page() {
  const user = await requireAuth({
    callbackUrl: "/billing",
  });
  const subscriptions = await getBillingSubscriptionsByUserId(user.id);
  const syncedSubscriptions =
    await syncBillingSubscriptionsFromStripe(subscriptions);
  const currentSubscription =
    syncedSubscriptions.find((subscription) =>
      activeStatuses.has(subscription.status ?? ""),
    ) ?? syncedSubscriptions[0];
  const stripeCustomerId =
    user.stripeCustomerId ?? currentSubscription?.stripeCustomerId;
  const transactions = await getBillingTransactions(
    stripeCustomerId,
    currentSubscription,
  );

  return (
    <AccountBillingPage
      subscriptions={syncedSubscriptions}
      transactions={transactions}
      user={user}
    />
  );
}
