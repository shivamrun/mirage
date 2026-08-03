import { z } from "zod";

const MAX_EMAIL_LENGTH = 254;

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);

    return code <= 31 || code === 127;
  });
}

export function normalizeEmail(email: string) {
  return email.trim().normalize("NFKC").toLowerCase();
}

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .email()
      .max(MAX_EMAIL_LENGTH)
      .refine((email) => !hasControlCharacters(email), {
        message: "Email cannot contain control characters.",
      }),
  );

/**
 * Creates the schema's primary UUID identifier.
 *
 * Mirrors the database idColumn helper for Zod object shapes.
 *
 * @example
 * ...idColumn()
 */
export function idColumn() {
  return {
    id: z.uuid(),
  };
}

/**
 * Creates a standard required email schema.
 *
 * @example
 * ...emailColumn()
 */
export function emailColumn() {
  return {
    email: emailSchema,
  };
}

/**
 * Creates standard record lifecycle timestamps.
 *
 * Includes:
 * - `createdAt` - automatically set when the record is created
 * - `updatedAt` - automatically set on creation and updated on changes
 *
 * @example
 * ...auditTimestamps()
 */
export function auditTimestamps() {
  return {
    createdAt: autoTimestamp("created_at"),
    updatedAt: autoTimestamp("updated_at"),
  };
}

/**
 * Creates a required timestamp that automatically defaults to the current time.
 *
 * @param name Database column name.
 */
export function autoTimestamp(_name: string) {
  return z.coerce.date();
}

/**
 * Creates a required timestamp without an automatic default.
 *
 * @param name Database column name.
 */
export function requiredTimestamp(_name: string) {
  return z.coerce.date();
}

/**
 * Creates an optional timestamp that may initially be NULL.
 *
 * @param name Database column name.
 */
export function eventTimestamp(_name: string) {
  return z.coerce.date().nullable();
}

/**
 * Creates standard moderation/review columns.
 *
 * Intended for records that follow a review lifecycle such as:
 * `pending -> approved | rejected`
 *
 * @example
 * ...moderationColumns()
 */
export function moderationColumns() {
  return {
    status: z
      .enum(["pending", "approved", "rejected"])
      .nullable()
      .default("pending"),
    rejectionReason: z.string().nullable(),
    reviewedBy: z.string().nullable(),
    reviewedAt: eventTimestamp("reviewed_at"),
  };
}
