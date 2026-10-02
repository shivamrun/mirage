import { AccountBillingPage } from "@/features/account/components";
import { requireAuth } from "@/server/db/services/auth/access";
import { getBillingOverview } from "@/server/db/services/billing/overview";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Billing", {
  path: "/billing",
});

type BillingPageProps = {
  searchParams: Promise<{
    checkout?: string;
  }>;
};

export default async function Page({ searchParams }: BillingPageProps) {
  const { checkout } = await searchParams;
  const user = await requireAuth({
    callbackUrl: "/billing",
  });

  const { creditBalance, subscriptions } = await getBillingOverview(user.id);

  return (
    <AccountBillingPage
      checkoutStatus={checkout}
      creditBalance={creditBalance}
      subscriptions={subscriptions}
      user={user}
    />
  );
}
