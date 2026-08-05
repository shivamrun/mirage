import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text } from "drizzle-orm/pg-core";

import {
  auditTimestamps,
  emailColumn,
  eventTimestamp,
  requiredTimestamp,
} from "./../helpers/base-column";

// Better Auth expects these default table names unless table mapping is
// configured explicitly, so auth tables intentionally do not use createTable.
export const user = pgTable("user", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),
  ...emailColumn({ unique: true }),

  emailVerified: boolean("email_verified").default(false).notNull(),

  image: text("image"),

  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: eventTimestamp("ban_expires"),

  ...auditTimestamps(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),

    expiresAt: requiredTimestamp("expires_at"),

    token: text("token").notNull().unique(),

    ...auditTimestamps(),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),

    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),

    accessTokenExpiresAt: eventTimestamp("access_token_expires_at"),

    refreshTokenExpiresAt: eventTimestamp("refresh_token_expires_at"),

    scope: text("scope"),
    password: text("password"),

    ...auditTimestamps(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),

    identifier: text("identifier").notNull(),
    value: text("value").notNull(),

    expiresAt: requiredTimestamp("expires_at"),

    ...auditTimestamps(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// RELATIONS

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
