import type { getCreditBalance } from "./ledger";

type CreditBalance = Awaited<ReturnType<typeof getCreditBalance>>;

export function toCreditBalanceResponse(balance: CreditBalance) {
  return {
    availableCredits: balance.account.availableCredits,
    carryForwardCredits: balance.account.carryForwardCredits,
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
      reversesLedgerEntryId: entry.reversesLedgerEntryId ?? null,
      source: entry.source,
      sourceId: entry.sourceId ?? null,
      type: entry.type,
    })),
  };
}
