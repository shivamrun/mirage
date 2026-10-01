import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  auditTimestamps,
  eventTimestamp,
  idColumn,
  requiredTimestamp,
} from "../helpers/base-column";
import { createTable } from "../helpers/create-table";
import { user } from "./auth-schema";

export const accountDeletionStates = ["deleting", "completed"] as const;

export const accountDeletionPhases = [
  "sessions_and_grants",
  "billing",
  "storage",
  "cross_user_data",
  "owned_data",
  "complete",
] as const;

export const userDataExportStatuses = [
  "pending",
  "processing",
  "ready",
  "failed",
  "expired",
] as const;

export const accountDeletionRequests = createTable(
  "account_deletion_requests",
  {
    ...idColumn(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    auditSubjectId: uuid("audit_subject_id").notNull().defaultRandom(),
    state: text("state", { enum: accountDeletionStates })
      .notNull()
      .default("deleting"),
    requestedAt: requiredTimestamp("requested_at").defaultNow(),
    deletingAt: eventTimestamp("deleting_at"),
    completedAt: eventTimestamp("completed_at"),
    cleanupPhase: text("cleanup_phase", { enum: accountDeletionPhases }),
    failureKind: text("failure_kind"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: eventTimestamp("last_attempt_at"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("account_deletion_requests_deleting_user_unique")
      .on(table.userId)
      .where(sql`${table.userId} is not null and ${table.state} = 'deleting'`),
    index("account_deletion_requests_state_idx").on(table.state),
  ],
);

export const userDataExports = createTable(
  "user_data_exports",
  {
    ...idColumn(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    deliveryDueAt: requiredTimestamp("delivery_due_at"),
    status: text("status", { enum: userDataExportStatuses })
      .notNull()
      .default("pending"),
    checksum: text("checksum"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    readyAt: eventTimestamp("ready_at"),
    failureKind: text("failure_kind"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: eventTimestamp("last_attempt_at"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("user_data_exports_active_user_unique")
      .on(table.userId)
      .where(
        sql`${table.userId} is not null and ${table.status} in ('pending', 'processing', 'failed')`,
      ),
    index("user_data_exports_status_due_idx").on(
      table.status,
      table.deliveryDueAt,
    ),
  ],
);
