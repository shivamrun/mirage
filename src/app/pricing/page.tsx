import type { Metadata } from "next";

import { AppHeader } from "@/components/app/app-header";
import { PricingPage } from "@/features/pricing/components";
import type { BillingInterval, PricingPlanKey } from "@/features/pricing/plans";
import { getCurrentUser } from "@/server/db/services/auth/access";
import {
  type BillingSubscriptionRecord,
  getBillingSubscriptionsForUser,
} from "@/server/db/services/billing/overview";
import {
  normalizeBillingInterval,
  normalizeBillingPlan,
} from "@/shared/billing";
import { getPageMetadata } from "@/shared/metadata";

export const metadata: Metadata = getPageMetadata("Pricing", {
  description: "Choose between the Free, Pro, and Hacker Mirage plans.",
  path: "/pricing",
});

const activeStatuses = new Set(["active", "trialing"]);

function getCurrentSubscription(subscriptions: BillingSubscriptionRecord[]) {
  return (
    subscriptions.find((subscription) =>
      activeStatuses.has(subscription.status ?? ""),
    ) ?? subscriptions[0]
  );
}

function getPlanKey(plan?: null | string): PricingPlanKey {
  return normalizeBillingPlan(plan) ?? "free";
}

function getBillingInterval(
  interval?: null | string,
): BillingInterval | undefined {
  return normalizeBillingInterval(interval) ?? undefined;
}

const Page = async () => {
  const user = await getCurrentUser();
  const subscriptions = user
    ? await getBillingSubscriptionsForUser(user.id)
    : [];
  const currentSubscription = getCurrentSubscription(subscriptions);

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader isAuthenticated={Boolean(user)} />
      <PricingPage
        currentInterval={getBillingInterval(
          currentSubscription?.billingInterval,
        )}
        currentPlan={getPlanKey(currentSubscription?.plan)}
        isAuthenticated={Boolean(user)}
        subscriptionId={currentSubscription?.stripeSubscriptionId}
      />
    </main>
  );
};

export default Page;
