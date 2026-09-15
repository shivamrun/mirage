import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  emailListStatusValues,
  emailSubscriptionStatusValues,
} from "@/lib/email-list/status";

import { auditTimestamps, emailColumn, idColumn } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const emailList = createTable("email_list", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: emailListStatusValues,
  })
    .notNull()
    .default("active"),
  emailVerificationRequired: boolean("email_verification_required")
    .notNull()
    .default(false),
  ...auditTimestamps(),
});

export const emailContact = createTable("email_contact", {
  ...idColumn(),
  ...emailColumn({ unique: true }),
  ...auditTimestamps(),
});

export const emailSubscription = createTable(
  "email_subscription",
  {
    ...idColumn(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => emailContact.id, { onDelete: "cascade" }),
    listKey: text("list_key")
      .notNull()
      .references(() => emailList.key, { onDelete: "restrict" }),
    status: text("status", {
      enum: emailSubscriptionStatusValues,
    })
      .notNull()
      .default("subscribed"),
    source: text("source"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("email_subscription_contact_list_unique").on(
      table.contactId,
      table.listKey,
    ),
    index("email_subscription_list_status_idx").on(table.listKey, table.status),
  ],
);

export const emailListRelations = relations(emailList, ({ many }) => ({
  subscriptions: many(emailSubscription),
}));

export const emailContactRelations = relations(emailContact, ({ many }) => ({
  subscriptions: many(emailSubscription),
}));

export const emailSubscriptionRelations = relations(
  emailSubscription,
  ({ one }) => ({
    contact: one(emailContact, {
      fields: [emailSubscription.contactId],
      references: [emailContact.id],
    }),
    list: one(emailList, {
      fields: [emailSubscription.listKey],
      references: [emailList.key],
    }),
  }),
);
