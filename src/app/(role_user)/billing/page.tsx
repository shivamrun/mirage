import { AccountBillingPage } from "@/features/account/components";
import { getBillingSubscriptionsByUserId } from "@/server/db/dal/billing";
import { requireAuth } from "@/server/db/services/auth/access";
import { syncBillingSubscriptionsFromStripe } from "@/server/db/services/billing/stripe-subscriptions";
import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { grantCreditTopUpForCheckoutSessionId } from "@/server/db/services/credits/top-up";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Billing", {
  path: "/billing",
});

type BillingPageProps = {
  searchParams: Promise<{
    creditCheckoutSessionId?: string;
  }>;
};

export default async function Page({ searchParams }: BillingPageProps) {
  const user = await requireAuth({
    callbackUrl: "/billing",
  });
  const { creditCheckoutSessionId } = await searchParams;

  if (creditCheckoutSessionId) {
    await grantCreditTopUpForCheckoutSessionId({
      sessionId: creditCheckoutSessionId,
      userId: user.id,
    });
  }

  const subscriptions = await getBillingSubscriptionsByUserId(user.id);
  const syncedSubscriptions =
    await syncBillingSubscriptionsFromStripe(subscriptions);
  const creditBalance = await getCreditBalance(user.id);

  return (
    <AccountBillingPage
      creditBalance={creditBalance}
      subscriptions={syncedSubscriptions}
      user={user}
    />
  );
}
