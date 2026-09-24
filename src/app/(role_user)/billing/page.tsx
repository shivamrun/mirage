import { AccountBillingPage } from "@/features/account/components";
import { getBillingSubscriptionsByUserId } from "@/server/db/dal/billing";
import { requireAuth } from "@/server/db/services/auth/access";
import { syncBillingSubscriptionsFromStripe } from "@/server/db/services/billing/stripe-subscriptions";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Billing", {
  path: "/billing",
});

export default async function Page() {
  const user = await requireAuth({
    callbackUrl: "/billing",
  });
  const subscriptions = await getBillingSubscriptionsByUserId(user.id);
  const syncedSubscriptions =
    await syncBillingSubscriptionsFromStripe(subscriptions);

  return <AccountBillingPage subscriptions={syncedSubscriptions} user={user} />;
}
