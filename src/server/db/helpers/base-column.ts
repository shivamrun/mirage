import { text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Creates the table's primary UUID identifier.
 *
 * - Uses PostgreSQL UUID
 * - Automatically generates a random UUID
 * - Marks the column as the primary key
 *
 * @example
 * ...idColumn()
 */
export function idColumn() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
  };
}

/**
 * Creates a standard required email column.
 *
 * @param options.unique Whether the database column should be unique.
 *
 * @example
 * ...emailColumn({ unique: true })
 */
export function emailColumn(options: { unique?: boolean } = {}) {
  const column = text("email").notNull();

  return {
    email: options.unique ? column.unique() : column,
  };
}

/**
 * Creates standard record lifecycle timestamps.
 *
 * Includes:
 * - `createdAt` — automatically set when the record is created
 * - `updatedAt` — automatically set on creation and updated on changes
 *
 * @example
 * ...auditTimestamps()
 */
export function auditTimestamps() {
  return {
    createdAt: autoTimestamp("created_at"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

/**
 * Creates a required timestamp that automatically defaults to the current time.
 *
 * Use when the timestamp should always exist and the database
 * should determine its initial value.
 *
 * Common uses:
 * - `createdAt`
 * - `updatedAt`
 * - `invitedAt`
 *
 * @param name Database column name.
 */
export function autoTimestamp(name: string) {
  return timestamp(name, { withTimezone: true }).notNull().defaultNow();
}

/**
 * Creates a required timestamp without an automatic default.
 *
 * Use when the timestamp must exist, but its value is determined
 * by application logic rather than the current database time.
 *
 * Common uses:
 * - `inviteExpiresAt`
 * - `scheduledPublishAt`
 * - `subscriptionEndsAt`
 *
 * @param name Database column name.
 */
export function requiredTimestamp(name: string) {
  return timestamp(name, { withTimezone: true }).notNull();
}

/**
 * Creates an optional timestamp that may initially be NULL.
 *
 * Use for events that may happen later and whose occurrence
 * should be recorded when they happen.
 *
 * Common uses:
 * - `acceptedAt`
 * - `revokedAt`
 * - `publishedAt`
 * - `deletedAt`
 *
 * @param name Database column name.
 */
export function eventTimestamp(name: string) {
  return timestamp(name, { withTimezone: true });
}

/**
 * Creates standard moderation/review columns.
 *
 * Intended for records that follow a review lifecycle such as:
 * `pending -> approved | rejected`
 *
 * Includes:
 * - `status`
 * - `rejectionReason`
 * - `reviewedBy`
 * - `reviewedAt`
 *
 * @example
 * ...moderationColumns()
 */
export function moderationColumns() {
  return {
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    }).default("pending"),

    rejectionReason: text("rejection_reason"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: eventTimestamp("reviewed_at"),
  };
}
