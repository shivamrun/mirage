import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  auditTimestamps,
  idColumn,
  requiredTimestamp,
} from "./../helpers/base-column";
import { session, user } from "./auth-schema";

export const adminSessionAssurance = pgTable(
  "adminSessionAssurance",
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
    uniqueIndex("adminSessionAssurance_sessionId_idx").on(table.sessionId),
    index("adminSessionAssurance_userId_idx").on(table.userId),
  ],
);
