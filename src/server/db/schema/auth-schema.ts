import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

export const invite = pgTable(
  "invite",
  {
    id: text("id").primaryKey(),

    token: text("token").notNull().unique(),
    createdAt: requiredTimestamp("created_at"),
    expiresAt: requiredTimestamp("expires_at"),
    maxUses: integer("max_uses").notNull(),
    infinityMaxUses: boolean("infinity_max_uses").default(false).notNull(),

    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    redirectToAfterUpgrade: text("redirect_to_after_upgrade"),
    shareInviterName: boolean("share_inviter_name").notNull(),
    email: text("email"),
    emails: text("emails").array(),
    role: text("role").notNull(),
    newAccount: boolean("new_account"),
    status: text("status", {
      enum: ["pending", "rejected", "canceled", "used", "expired"],
    }).notNull(),
  },
  (table) => [
    index("invite_createdByUserId_idx").on(table.createdByUserId),
    index("invite_status_idx").on(table.status),
    uniqueIndex("invite_pending_email_role_unique_idx")
      .on(table.email, table.role)
      .where(sql`${table.status} = 'pending' and ${table.email} is not null`),
  ],
);

export const inviteUse = pgTable(
  "invite_use",
  {
    id: text("id").primaryKey(),

    inviteId: text("invite_id")
      .notNull()
      .references(() => invite.id, {
        onDelete: "cascade",
      }),
    usedAt: requiredTimestamp("used_at"),
    usedByUserId: text("used_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("inviteUse_inviteId_idx").on(table.inviteId),
    index("inviteUse_usedByUserId_idx").on(table.usedByUserId),
  ],
);

// RELATIONS

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  createdInvites: many(invite),
  inviteUses: many(inviteUse),
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

export const inviteRelations = relations(invite, ({ many, one }) => ({
  creator: one(user, {
    fields: [invite.createdByUserId],
    references: [user.id],
  }),
  uses: many(inviteUse),
}));

export const inviteUseRelations = relations(inviteUse, ({ one }) => ({
  invite: one(invite, {
    fields: [inviteUse.inviteId],
    references: [invite.id],
  }),
  user: one(user, {
    fields: [inviteUse.usedByUserId],
    references: [user.id],
  }),
}));
