import Link from "next/link";

import { HeadingBlock } from "@/components/heading-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountBillingActions } from "@/features/account/components/account-billing-actions";
import { AccountBillingPortalButton } from "@/features/account/components/account-billing-portal-button";
import {
  AccountSection,
  AccountSectionStack,
} from "@/features/account/components/account-section";
import type { BillingSubscriptionRecord } from "@/server/db/dal/billing";
import type { CurrentUser } from "@/server/db/services/auth/access";
import type { BillingTransaction } from "@/server/db/services/billing/stripe-subscriptions";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const activeStatuses = new Set(["active", "trialing"]);

function formatDate(value: Date | null | undefined) {
  return value ? dateTimeFormatter.format(value) : "Not set";
}

function formatPlanName(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBillingInterval(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTransactionBillingInterval(value: string | null | undefined) {
  if (value === "month") {
    return "Monthly";
  }

  if (value === "year") {
    return "Annual";
  }

  return formatBillingInterval(value);
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

function getCurrentSubscription(subscriptions: BillingSubscriptionRecord[]) {
  return (
    subscriptions.find((subscription) =>
      activeStatuses.has(subscription.status ?? ""),
    ) ?? subscriptions[0]
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-border border-t py-3 first:border-t-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="font-medium text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{value}</dd>
    </div>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amount / 100);
}

function formatOptionalCurrency(amount: null | number, currency: string) {
  return amount === null ? "-" : formatCurrency(amount, currency);
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
          description="You are currently using the free workspace."
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

  const canCancel = Boolean(
    subscription.stripeSubscriptionId &&
      activeStatuses.has(subscription.status ?? "") &&
      !subscription.cancelAtPeriodEnd &&
      !subscription.cancelAt,
  );

  const canRestore = Boolean(
    subscription.stripeSubscriptionId &&
      activeStatuses.has(subscription.status ?? "") &&
      (subscription.cancelAtPeriodEnd || subscription.cancelAt),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <HeadingBlock
          className="min-w-0"
          description={
            subscription.cancelAtPeriodEnd
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
          label="Current period start"
          value={formatDate(subscription.periodStart)}
        />

        <DetailRow
          label="Current period end"
          value={formatDate(subscription.periodEnd)}
        />

        <DetailRow
          label="Cancel at period end"
          value={subscription.cancelAtPeriodEnd ? "Yes" : "No"}
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
  transactions,
}: {
  hasStripeCustomer: boolean;
  transactions: BillingTransaction[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm leading-6">
          {transactions.length === 0
            ? "No Stripe invoices have been recorded for this customer yet."
            : "Showing the most recent invoices from Stripe."}
        </p>

        <AccountBillingPortalButton
          disabled={!hasStripeCustomer}
          label="View all transactions"
          variant="outline"
        />
      </div>

      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-border border-b">
                <th className="px-0 py-2 pr-4 font-medium">Plan</th>
                <th className="px-0 py-2 pr-4 font-medium">Billing</th>
                <th className="px-0 py-2 pr-4 font-medium">Expires</th>
                <th className="px-0 py-2 pr-4 font-medium">Date</th>
                <th className="px-0 py-2 pr-4 font-medium">Status</th>
                <th className="px-0 py-2 pr-4 text-right font-medium">
                  Amount
                </th>
                <th className="px-0 py-2 text-right font-medium">Receipt</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => (
                <tr
                  className="border-border border-b last:border-b-0"
                  key={transaction.id}
                >
                  <td className="px-0 py-3 pr-4">
                    {transaction.planName ??
                      transaction.invoiceNumber ??
                      transaction.id}
                  </td>

                  <td className="px-0 py-3 pr-4">
                    {formatTransactionBillingInterval(
                      transaction.billingInterval,
                    )}
                  </td>

                  <td className="px-0 py-3 pr-4">
                    {formatDate(transaction.expiresAt)}
                  </td>

                  <td className="px-0 py-3 pr-4">
                    {dateTimeFormatter.format(transaction.timestamp)}
                  </td>

                  <td className="px-0 py-3 pr-4">
                    {formatStatus(transaction.status)}
                  </td>

                  <td className="px-0 py-3 pr-4 text-right">
                    {formatOptionalCurrency(
                      transaction.amountPaid,
                      transaction.currency,
                    )}
                  </td>

                  <td className="px-0 py-3 text-right">
                    {transaction.hostedInvoiceUrl ? (
                      <a
                        className="link-text"
                        href={transaction.hostedInvoiceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AccountBillingPage({
  subscriptions,
  transactions,
  user,
}: {
  subscriptions: BillingSubscriptionRecord[];
  transactions: BillingTransaction[];
  user: CurrentUser;
}) {
  const currentSubscription = getCurrentSubscription(subscriptions);

  const stripeCustomerId =
    user.stripeCustomerId ?? currentSubscription?.stripeCustomerId;

  const hasStripeCustomer = Boolean(stripeCustomerId);

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
            description="Recent invoices and payments from Stripe."
            title="Transaction history"
          >
            <TransactionHistory
              hasStripeCustomer={hasStripeCustomer}
              transactions={transactions}
            />
          </AccountSection>
        </AccountSectionStack>
      </div>
    </main>
  );
}

export { AccountBillingPage };