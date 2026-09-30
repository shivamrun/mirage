import { index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  NotificationPayloadMap,
  NotificationType,
} from "@/features/notifications";
import {
  auditTimestamps,
  eventTimestamp,
  idColumn,
} from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const emailDeliveryStatuses = [
  "pending",
  "processing",
  "sent",
  "failed",
] as const;

export const emailDeliveries = createTable(
  "email_deliveries",
  {
    ...idColumn(),
    attemptCount: integer("attempt_count").notNull().default(0),
    data: jsonb("data")
      .$type<NotificationPayloadMap[NotificationType]>()
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    lastErrorKind: text("last_error_kind"),
    notificationType: text("notification_type")
      .$type<NotificationType>()
      .notNull(),
    providerMessageId: text("provider_message_id"),
    recipientId: text("recipient_id"),
    sentAt: eventTimestamp("sent_at"),
    status: text("status", { enum: emailDeliveryStatuses })
      .notNull()
      .default("pending"),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("email_deliveries_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    index("email_deliveries_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
