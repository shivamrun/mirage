import { relations } from "drizzle-orm";
import { index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  NotificationCategory,
  NotificationPayloadMap,
  NotificationType,
} from "@/features/notifications";
import {
  auditTimestamps,
  eventTimestamp,
  idColumn,
} from "@/server/db/helpers/base-column";
import { createTable } from "@/server/db/helpers/create-table";
import { user } from "./auth-schema";

export const notification = createTable(
  "notification",
  {
    ...idColumn(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    archivedAt: eventTimestamp("archived_at"),
    category: text("category").$type<NotificationCategory>().notNull(),
    data: jsonb("data")
      .$type<NotificationPayloadMap[NotificationType]>()
      .notNull(),
    idempotencyKey: text("idempotency_key"),
    readAt: eventTimestamp("read_at"),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
    seenAt: eventTimestamp("seen_at"),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    type: text("type").$type<NotificationType>().notNull(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("mirage_notification_idempotency_key_idx").on(
      table.idempotencyKey,
    ),
    index("mirage_notification_recipient_idx").on(table.recipientId),
    index("mirage_notification_recipient_created_at_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    index("mirage_notification_recipient_read_at_idx").on(
      table.recipientId,
      table.readAt,
    ),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  actor: one(user, {
    fields: [notification.actorId],
    references: [user.id],
  }),
  recipient: one(user, {
    fields: [notification.recipientId],
    references: [user.id],
  }),
}));
