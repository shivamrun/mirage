import Link from "next/link";

import { HeadingBlock } from "@/components/heading-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountBillingActions } from "@/features/account/components/account-billing-actions";
import { AccountBillingFinalizer } from "@/features/account/components/account-billing-finalizer";
import { AccountBillingPortalButton } from "@/features/account/components/account-billing-portal-button";
import { AccountCreditTopUpButton } from "@/features/account/components/account-credit-top-up-button";
import {
  AccountSection,
  AccountSectionStack,
} from "@/features/account/components/account-section";
import { pricingPlans } from "@/features/pricing/plans";
import type { CurrentUser } from "@/server/db/services/auth/access";
import type { BillingSubscriptionRecord } from "@/server/db/services/billing/overview";
import type { getCreditBalance } from "@/server/db/services/credits/ledger";
import {
  getBillingPlanCredits,
  getBillingPlanDisplayName,
} from "@/shared/billing";

type CreditBalance = Awaited<ReturnType<typeof getCreditBalance>>;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const activeStatuses = new Set(["active", "trialing"]);

function formatDate(value: Date | null | undefined) {
  return value ? dateTimeFormatter.format(value) : "Not set";
}

function formatPlanName(value: string) {
  return getBillingPlanDisplayName(value) ?? value;
}

function getPlanCredits(plan?: null | string) {
  return getBillingPlanCredits(plan) || pricingPlans[0].credits;
}

function formatCredits(value: number) {
  return `${value} monthly credits`;
}

function formatBillingInterval(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCancellationScheduled(subscription: BillingSubscriptionRecord) {
  return Boolean(subscription.cancelAtPeriodEnd || subscription.cancelAt);
}

function getCurrentSubscription(subscriptions: BillingSubscriptionRecord[]) {
  return (
    subscriptions.find((subscription) =>
      activeStatuses.has(subscription.status ?? ""),
    ) ?? subscriptions[0]
  );
}

function getBillingSnapshotKey({
  creditBalance,
  subscription,
}: {
  creditBalance: CreditBalance;
  subscription?: BillingSubscriptionRecord;
}) {
  return JSON.stringify({
    credits: {
      allowance: creditBalance.currentPeriod.allowance,
      available: creditBalance.account.availableCredits,
      carryForward: creditBalance.account.carryForwardCredits,
      periodEnd: creditBalance.currentPeriod.periodEnd.toISOString(),
      periodStart: creditBalance.currentPeriod.periodStart.toISOString(),
      plan: creditBalance.currentPeriod.plan,
    },
    subscription: subscription
      ? {
          billingInterval: subscription.billingInterval,
          id: subscription.id,
          periodEnd: subscription.periodEnd?.toISOString() ?? null,
          periodStart: subscription.periodStart?.toISOString() ?? null,
          plan: subscription.plan,
          status: subscription.status,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        }
      : null,
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-border border-t py-3 first:border-t-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="font-medium text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{value}</dd>
    </div>
  );
}

function SubscriptionSummary({
  hasStripeCustomer,
  subscription,
}: {
  hasStripeCustomer: boolean;
  subscription?: BillingSubscriptionRecord;
}) {
  if (!subscription) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HeadingBlock
          className="min-w-0"
          description={`You are currently using the free workspace with ${formatCredits(
            getPlanCredits("free"),
          )}.`}
          size="sm"
          title="Free plan"
          titleAs="h3"
        />

        <Button asChild>
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    );
  }

  const isActive = activeStatuses.has(subscription.status ?? "");
  const cancellationScheduled = isCancellationScheduled(subscription);

  const canCancel = Boolean(
    subscription.stripeSubscriptionId &&
      activeStatuses.has(subscription.status ?? "") &&
      !cancellationScheduled,
  );

  const canRestore = Boolean(
    subscription.stripeSubscriptionId &&
      activeStatuses.has(subscription.status ?? "") &&
      cancellationScheduled,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <HeadingBlock
          className="min-w-0"
          description={
            cancellationScheduled
              ? "This subscription is scheduled to end at the current period."
              : "Your billing state is synced from Stripe webhooks."
          }
          size="sm"
          title={`${formatPlanName(subscription.plan)} plan`}
          titleAs="h3"
        />

        <Badge variant={isActive ? "default" : "secondary"}>
          {formatStatus(subscription.status)}
        </Badge>
      </div>

      <dl>
        <DetailRow
          label="Billing interval"
          value={formatBillingInterval(subscription.billingInterval)}
        />

        <DetailRow
          label="Credit allowance"
          value={formatCredits(getPlanCredits(subscription.plan))}
        />

        <DetailRow
          label="Current period start"
          value={formatDate(subscription.periodStart)}
        />

        <DetailRow
          label="Current period end"
          value={formatDate(subscription.periodEnd)}
        />

        <DetailRow
          label="Cancel at period end"
          value={cancellationScheduled ? "Yes" : "No"}
        />

        <DetailRow
          label="Cancellation date"
          value={
            cancellationScheduled
              ? formatDate(subscription.cancelAt ?? subscription.periodEnd)
              : "Not set"
          }
        />

        <DetailRow
          label="Stripe subscription"
          value={subscription.stripeSubscriptionId ?? "Not set"}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <AccountBillingPortalButton disabled={!hasStripeCustomer} />

        <AccountBillingActions
          canCancel={canCancel}
          canRestore={canRestore}
          subscriptionId={subscription.stripeSubscriptionId}
        />
      </div>
    </div>
  );
}

function TransactionHistory({
  hasStripeCustomer,
}: {
  hasStripeCustomer: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm leading-6">
        Open Stripe to review invoices, receipts, and payments.
      </p>

      <AccountBillingPortalButton
        disabled={!hasStripeCustomer}
        label="View all transaction history"
        variant="outline"
      />
    </div>
  );
}

function AccountBillingPage({
  checkoutStatus,
  creditBalance,
  subscriptions,
  user,
}: {
  checkoutStatus?: string;
  creditBalance: CreditBalance;
  subscriptions: BillingSubscriptionRecord[];
  user: CurrentUser;
}) {
  const currentSubscription = getCurrentSubscription(subscriptions);

  const stripeCustomerId =
    user.stripeCustomerId ?? currentSubscription?.stripeCustomerId;

  const hasStripeCustomer = Boolean(stripeCustomerId);
  const billingSnapshotKey = getBillingSnapshotKey({
    creditBalance,
    subscription: currentSubscription,
  });

  return (
    <main className="w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-6 pb-14">
        <HeadingBlock
          as="header"
          className="px-6 py-4"
          description="Review your plan, subscription, and billing history."
          size="xl"
          title="Billing"
          titleAs="h1"
        />

        <AccountBillingFinalizer
          checkoutStatus={checkoutStatus}
          snapshotKey={billingSnapshotKey}
        />

        <AccountSectionStack>
          <AccountSection
            description="Your current plan and renewal information."
            title="Current plan"
          >
            <SubscriptionSummary
              hasStripeCustomer={hasStripeCustomer}
              subscription={currentSubscription}
            />
          </AccountSection>

          <AccountSection
            description="Monthly credits reset by period. Purchased credits carry forward until spent."
            title="Credits"
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-3xl tracking-normal">
                    {creditBalance.account.availableCredits} /{" "}
                    {creditBalance.currentPeriod.allowance}
                  </p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Credits available, including purchased carry-forward credits
                  </p>
                </div>
                <AccountCreditTopUpButton
                  billingSnapshotKey={billingSnapshotKey}
                />
              </div>

              <dl>
                <DetailRow
                  label="Purchased carry-forward"
                  value={`${creditBalance.account.carryForwardCredits} credits`}
                />
                <DetailRow
                  label="Plan"
                  value={formatPlanName(creditBalance.currentPeriod.plan)}
                />
                <DetailRow
                  label="Current period start"
                  value={formatDate(creditBalance.currentPeriod.periodStart)}
                />
                <DetailRow
                  label="Current period end"
                  value={formatDate(creditBalance.currentPeriod.periodEnd)}
                />
              </dl>
            </div>
          </AccountSection>

          <AccountSection
            description="Invoices and payments are managed in Stripe."
            title="Transaction history"
          >
            <TransactionHistory hasStripeCustomer={hasStripeCustomer} />
          </AccountSection>
        </AccountSectionStack>
      </div>
    </main>
  );
}

export { AccountBillingPage };
