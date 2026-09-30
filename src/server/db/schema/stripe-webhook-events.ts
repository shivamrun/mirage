import { index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  auditTimestamps,
  eventTimestamp,
  idColumn,
} from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const stripeWebhookEventStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const stripeWebhookEvents = createTable(
  "stripe_webhook_events",
  {
    ...idColumn(),
    attemptCount: integer("attempt_count").notNull().default(0),
    eventType: text("event_type").notNull(),
    lastErrorKind: text("last_error_kind"),
    lastErrorMessage: text("last_error_message"),
    objectId: text("object_id").notNull(),
    processedAt: eventTimestamp("processed_at"),
    status: text("status", { enum: stripeWebhookEventStatuses })
      .notNull()
      .default("pending"),
    stripeEventId: text("stripe_event_id").notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_event_id_unique").on(
      table.stripeEventId,
    ),
    index("stripe_webhook_events_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
