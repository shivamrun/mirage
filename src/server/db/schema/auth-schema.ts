import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";

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
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),

  image: text("image"),
  stripeCustomerId: text("stripe_customer_id"),

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

export const twoFactor = pgTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),

    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    verified: boolean("verified").default(true).notNull(),
    failedVerificationCount: integer("failed_verification_count")
      .default(0)
      .notNull(),
    lockedUntil: eventTimestamp("locked_until"),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),

    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(),

    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),

    status: text("status").default("incomplete"),

    periodStart: eventTimestamp("period_start"),
    periodEnd: eventTimestamp("period_end"),
    trialStart: eventTimestamp("trial_start"),
    trialEnd: eventTimestamp("trial_end"),

    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    cancelAt: eventTimestamp("cancel_at"),
    canceledAt: eventTimestamp("canceled_at"),
    endedAt: eventTimestamp("ended_at"),

    seats: integer("seats"),
    billingInterval: text("billing_interval"),
    stripeScheduleId: text("stripe_schedule_id"),
  },
  (table) => [
    index("subscription_referenceId_idx").on(table.referenceId),
    index("subscription_stripeCustomerId_idx").on(table.stripeCustomerId),
    index("subscription_stripeSubscriptionId_idx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

// RELATIONS

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
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

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));
