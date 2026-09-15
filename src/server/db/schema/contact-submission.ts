import { text } from "drizzle-orm/pg-core";

import { contactSubmissionStatusValues } from "@/zod/contact-submission";

import { auditTimestamps, emailColumn, idColumn } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const contactSubmission = createTable("contact_submission", {
  ...idColumn(),
  name: text("name").notNull(),
  ...emailColumn(),
  company: text("company"),
  message: text("message").notNull(),
  status: text("status", {
    enum: contactSubmissionStatusValues,
  })
    .notNull()
    .default("new"),
  ...auditTimestamps(),
});
