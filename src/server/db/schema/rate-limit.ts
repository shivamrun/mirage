import { bigint, index, integer, primaryKey, text } from "drizzle-orm/pg-core";

import { requiredTimestamp } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const applicationRateLimit = createTable(
  "rate_limit",
  {
    scope: text("scope").notNull(),
    identifierHash: text("identifier_hash").notNull(),
    count: integer("count").notNull(),
    resetAt: requiredTimestamp("reset_at"),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.identifierHash] }),
    index("rate_limit_reset_at_idx").on(table.resetAt),
  ],
);

// Better Auth resolves this schema object by the model name `rateLimit`.
export const rateLimit = createTable("auth_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
