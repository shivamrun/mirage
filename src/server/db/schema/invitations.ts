import { index, text, uniqueIndex } from "drizzle-orm/pg-core";
import { invitationStatusValues } from "@/shared/schemas/invitations";
import {
  auditTimestamps,
  emailColumn,
  eventTimestamp,
  idColumn,
  requiredTimestamp,
} from "../helpers/base-column";
import { createTable } from "../helpers/create-table";
import { user } from "./auth-schema";

export const invitation = createTable(
  "invitation",
  {
    ...idColumn(),
    ...emailColumn(),
    role: text("role").notNull().default("user"),
    status: text("status", { enum: invitationStatusValues })
      .notNull()
      .default("pending"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: requiredTimestamp("expires_at"),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: eventTimestamp("accepted_at"),
    revokedAt: eventTimestamp("revoked_at"),
    ...auditTimestamps(),
  },
  (table) => [
    index("invitation_email_idx").on(table.email),
    index("invitation_status_idx").on(table.status),
    index("invitation_expires_at_idx").on(table.expiresAt),
    uniqueIndex("invitation_token_hash_idx").on(table.tokenHash),
    index("invitation_invited_by_user_id_idx").on(table.invitedByUserId),
    index("invitation_accepted_by_user_id_idx").on(table.acceptedByUserId),
  ],
);
