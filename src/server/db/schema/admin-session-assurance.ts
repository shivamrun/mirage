import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  auditTimestamps,
  idColumn,
  requiredTimestamp,
} from "./../helpers/base-column";
import { session, user } from "./auth-schema";

export const adminSessionAssurance = pgTable(
  "admin_session_assurance",
  {
    ...idColumn(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    method: text("method", { enum: ["totp"] }).notNull(),
    expiresAt: requiredTimestamp("expires_at"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("admin_session_assurance_session_id_idx").on(table.sessionId),
    index("admin_session_assurance_user_id_idx").on(table.userId),
  ],
);
