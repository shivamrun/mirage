import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { auditTimestamps, requiredTimestamp } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";
import { user } from "./auth-schema";

export const creditLedgerEntryTypes = [
  "grant",
  "top_up",
  "spend",
  "refund",
  "manual_credit",
  "manual_debit",
  "expire",
  "revoke",
] as const;

export const creditAccounts = createTable("credit_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  availableCredits: integer("available_credits").notNull().default(0),
  carryForwardCredits: integer("carry_forward_credits").notNull().default(0),
  lifetimeGranted: integer("lifetime_granted").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  lifetimeExpired: integer("lifetime_expired").notNull().default(0),
  ...auditTimestamps(),
});

export const creditLedgerEntries = createTable(
  "credit_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: text("type", { enum: creditLedgerEntryTypes }).notNull(),
    periodStart: requiredTimestamp("period_start"),
    periodEnd: requiredTimestamp("period_end"),
    idempotencyKey: text("idempotency_key").notNull(),
    operationFingerprint: text("operation_fingerprint"),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    reversesLedgerEntryId: uuid("reverses_ledger_entry_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...auditTimestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.reversesLedgerEntryId],
      foreignColumns: [table.id],
      name: "credit_ledger_entries_reversal_fk",
    }).onDelete("restrict"),
    uniqueIndex("credit_ledger_entries_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    index("credit_ledger_entries_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("credit_ledger_entries_period_end_idx").on(table.periodEnd),
    index("credit_ledger_entries_source_idx").on(table.source, table.sourceId),
    index("credit_ledger_entries_reversal_idx").on(table.reversesLedgerEntryId),
  ],
);

export const creditPeriodGrants = createTable(
  "credit_period_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    allowance: integer("allowance").notNull(),
    periodStart: requiredTimestamp("period_start"),
    periodEnd: requiredTimestamp("period_end"),
    subscriptionId: text("subscription_id"),
    periodKey: text("period_key").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("credit_period_grants_period_key_unique").on(table.periodKey),
    index("credit_period_grants_user_period_idx").on(
      table.userId,
      table.periodStart,
      table.periodEnd,
    ),
    index("credit_period_grants_subscription_idx").on(table.subscriptionId),
  ],
);

export const creditAccountRelations = relations(
  creditAccounts,
  ({ one, many }) => ({
    user: one(user, {
      fields: [creditAccounts.userId],
      references: [user.id],
    }),
    ledgerEntries: many(creditLedgerEntries),
    periodGrants: many(creditPeriodGrants),
  }),
);

export const creditLedgerEntryRelations = relations(
  creditLedgerEntries,
  ({ one }) => ({
    user: one(user, {
      fields: [creditLedgerEntries.userId],
      references: [user.id],
    }),
    reversedEntry: one(creditLedgerEntries, {
      fields: [creditLedgerEntries.reversesLedgerEntryId],
      references: [creditLedgerEntries.id],
    }),
  }),
);

export const creditPeriodGrantRelations = relations(
  creditPeriodGrants,
  ({ one }) => ({
    user: one(user, {
      fields: [creditPeriodGrants.userId],
      references: [user.id],
    }),
  }),
);
