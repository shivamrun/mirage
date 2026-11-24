import { index, integer, jsonb, text } from "drizzle-orm/pg-core";
import type { BillingAnalyticsEvent } from "@/adapters/analytics/events";
import {
  autoTimestamp,
  eventTimestamp,
  requiredTimestamp,
} from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const billingAnalytics = createTable(
  "billing_analytics",
  {
    key: text("key").primaryKey(),
    event: jsonb("event").$type<BillingAnalyticsEvent>(),
    occurredAt: requiredTimestamp("occurred_at"),
    availableAt: autoTimestamp("available_at"),
    attempts: integer("attempts").notNull().default(0),
    claimToken: text("claim_token"),
    deliveredAt: eventTimestamp("delivered_at"),
  },
  (table) => [index("billing_analytics_available_idx").on(table.availableAt)],
);
