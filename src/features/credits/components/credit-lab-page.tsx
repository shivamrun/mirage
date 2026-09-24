"use client";

import { FlaskConical, Sparkles } from "lucide-react";
import * as React from "react";

import { HeadingBlock } from "@/components/heading-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AccountSection,
  AccountSectionStack,
} from "@/features/account/components/account-section";
import type { getCreditBalance } from "@/server/db/services/credits/ledger";
import { api } from "@/shared/api/client";
import {
  creditSampleItems,
  type CreditSampleItemKey,
} from "@/shared/credits/sample-catalog";
import type {
  CreditBalanceResponse,
  CreditSampleCreateResponse,
} from "@/shared/schemas";

type CreditBalance = Awaited<ReturnType<typeof getCreditBalance>>;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string) {
  return dateTimeFormatter.format(new Date(value));
}

function toBalanceResponse(balance: CreditBalance): CreditBalanceResponse {
  return {
    availableCredits: balance.account.availableCredits,
    currentPeriod: {
      allowance: balance.currentPeriod.allowance,
      periodEnd: balance.currentPeriod.periodEnd.toISOString(),
      periodStart: balance.currentPeriod.periodStart.toISOString(),
      plan: balance.currentPeriod.plan,
    },
    lifetimeExpired: balance.account.lifetimeExpired,
    lifetimeGranted: balance.account.lifetimeGranted,
    lifetimeSpent: balance.account.lifetimeSpent,
    recentLedger: balance.recentLedger.map((entry) => ({
      amount: entry.amount,
      createdAt: entry.createdAt.toISOString(),
      id: entry.id,
      idempotencyKey: entry.idempotencyKey,
      metadata: entry.metadata ?? null,
      periodEnd: entry.periodEnd.toISOString(),
      periodStart: entry.periodStart.toISOString(),
      reversesLedgerEntryId: entry.reversesLedgerEntryId,
      source: entry.source,
      sourceId: entry.sourceId,
      type: entry.type,
    })),
  };
}

function responseMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function CreditLabPage({ balance }: { balance: CreditBalance }) {
  const [creditBalance, setCreditBalance] = React.useState(() =>
    toBalanceResponse(balance),
  );
  const [created, setCreated] =
    React.useState<CreditSampleCreateResponse["created"]>();
  const [statusMessage, setStatusMessage] = React.useState<{
    message: string;
    tone: "error" | "success";
  }>();
  const [pendingItemKey, setPendingItemKey] =
    React.useState<CreditSampleItemKey>();

  async function createSampleItem(itemKey: CreditSampleItemKey) {
    setPendingItemKey(itemKey);
    setStatusMessage(undefined);

    try {
      const result = await api.api.credits["sample-create"].post({
        idempotencyKey: `credit-lab:${crypto.randomUUID()}`,
        itemKey,
      });

      if (result.error) {
        setStatusMessage({
          tone: "error",
          message: responseMessage(
            result.error.value,
            "Could not create the sample entry.",
          ),
        });
        return;
      }

      setCreditBalance(result.data.balance);
      setCreated(result.data.created);
      setStatusMessage({
        tone: "success",
        message: `${result.data.created.title}.`,
      });
    } catch {
      setStatusMessage({
        tone: "error",
        message: "Could not create the sample entry.",
      });
    } finally {
      setPendingItemKey(undefined);
    }
  }

  return (
    <main className="w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-6 pb-14">
        <HeadingBlock
          as="header"
          className="px-6 py-4"
          description="Spend credits on sample entries and watch the ledger update."
          size="xl"
          title="Credit Lab"
          titleAs="h1"
        />

        <AccountSectionStack>
          <AccountSection
            description="Your current ledger balance for this billing period."
            title="Balance"
          >
            <div className="space-y-1">
              <p className="font-semibold text-3xl tracking-normal">
                {creditBalance.availableCredits} /{" "}
                {creditBalance.currentPeriod.allowance}
              </p>
              <p className="text-muted-foreground text-sm">
                Credits remaining this period
              </p>
            </div>
          </AccountSection>

          <AccountSection
            description="Choose a sample item to create with credits."
            title="Create sample"
          >
            <div className="space-y-5">
              {statusMessage ? (
                <div
                  className={
                    statusMessage.tone === "success"
                      ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 text-sm dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"
                      : "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm"
                  }
                >
                  {statusMessage.message}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                {creditSampleItems.map((item) => {
                  const isPending = pendingItemKey === item.key;
                  const isTooExpensive =
                    item.credits > creditBalance.availableCredits;

                  return (
                    <article
                      className="flex min-h-52 flex-col rounded-lg border border-border bg-background p-4"
                      key={item.key}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-medium text-base leading-6">
                            {item.name}
                          </h3>
                          <p className="text-muted-foreground text-sm leading-6">
                            {item.description}
                          </p>
                        </div>
                        <Badge
                          variant={isTooExpensive ? "secondary" : "default"}
                        >
                          {item.credits}
                        </Badge>
                      </div>

                      <div className="mt-auto space-y-3 pt-5">
                        {isTooExpensive ? (
                          <p className="text-muted-foreground text-xs leading-5">
                            You need{" "}
                            {item.credits - creditBalance.availableCredits} more
                            credits.
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs leading-5">
                            Ready to create with your current balance.
                          </p>
                        )}
                        <Button
                          className="w-full"
                          disabled={Boolean(pendingItemKey)}
                          onClick={() => void createSampleItem(item.key)}
                          type="button"
                          variant={isTooExpensive ? "outline" : "default"}
                        >
                          {isPending ? "Creating..." : "Create"}
                          <Sparkles data-icon="inline-end" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {created ? (
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <FlaskConical className="size-4" />
                    {created.title}
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">
                    {created.body}
                  </p>
                </div>
              ) : null}
            </div>
          </AccountSection>

          <AccountSection
            description="Recent grant, spend, refund, expiration, and adjustment rows."
            title="Recent ledger"
          >
            <div className="divide-y divide-border">
              {creditBalance.recentLedger.map((entry) => (
                <div
                  className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr_6rem] sm:items-center"
                  key={entry.id}
                >
                  <span className="font-medium text-sm">{entry.type}</span>
                  <span className="min-w-0 break-words text-muted-foreground text-sm">
                    {entry.source}
                    {entry.sourceId ? ` / ${entry.sourceId}` : ""}
                  </span>
                  <span className="text-left font-medium text-sm tabular-nums sm:text-right">
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount}
                  </span>
                  <span className="text-muted-foreground text-xs sm:col-span-3">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </AccountSection>
        </AccountSectionStack>
      </div>
    </main>
  );
}

export { CreditLabPage };
