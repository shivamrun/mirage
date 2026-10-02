import { index, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, eventTimestamp } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";
import { user } from "./auth-schema";

export const billingCreditPurchaseStatuses = [
  "pending",
  "checkout_created",
  "paid",
  "fulfilled",
  "failed",
] as const;

export const billingCreditPurchases = createTable(
  "billing_credit_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    packageKey: text("package_key").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    credits: integer("credits").notNull(),
    status: text("status", { enum: billingCreditPurchaseStatuses })
      .notNull()
      .default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: eventTimestamp("paid_at"),
    fulfilledAt: eventTimestamp("fulfilled_at"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("billing_credit_purchases_request_id_unique").on(
      table.requestId,
    ),
    uniqueIndex("billing_credit_purchases_checkout_session_unique").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("billing_credit_purchases_payment_intent_unique").on(
      table.stripePaymentIntentId,
    ),
    index("billing_credit_purchases_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("billing_credit_purchases_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
