import type { Metadata } from "next";

import { AppHeader } from "@/components/app/app-header";
import { PricingPage } from "@/features/pricing/components";
import {
  type BillingInterval,
  type PricingPlanKey,
  pricingPlans,
} from "@/features/pricing/plans";
import {
  type BillingSubscriptionRecord,
  getBillingSubscriptionsByUserId,
} from "@/server/db/dal/billing";
import { getCurrentUser } from "@/server/db/services/auth/access";
import { syncBillingSubscriptionsFromStripe } from "@/server/db/services/billing/stripe-subscriptions";
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

function normalizePlanName(plan?: null | string) {
  return plan?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function getPlanKey(plan?: null | string): PricingPlanKey {
  const normalizedPlan = normalizePlanName(plan);
  const matchedPlan = pricingPlans.find((pricingPlan) => {
    const checkoutPlanName =
      "checkoutPlanName" in pricingPlan
        ? pricingPlan.checkoutPlanName
        : undefined;

    return (
      normalizedPlan === normalizePlanName(pricingPlan.key) ||
      normalizedPlan === normalizePlanName(pricingPlan.name) ||
      normalizedPlan === normalizePlanName(checkoutPlanName)
    );
  });

  return matchedPlan?.key ?? "free";
}

function getBillingInterval(
  interval?: null | string,
): BillingInterval | undefined {
  if (interval === "month") {
    return "monthly";
  }

  if (interval === "year") {
    return "annual";
  }
}

const Page = async () => {
  const user = await getCurrentUser();
  const subscriptions = user
    ? await syncBillingSubscriptionsFromStripe(
        await getBillingSubscriptionsByUserId(user.id),
      )
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
