import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { auditTimestamps, idColumn } from "../helpers/base-column";
import { createTable } from "../helpers/create-table";

export const billingPlan = createTable(
  "billing_plan",
  {
    ...idColumn(),
    name: text("name").notNull(),
    description: text("description"),
    stripePriceId: text("stripe_price_id").notNull(),
    stripeAnnualDiscountPriceId: text("stripe_annual_discount_price_id"),
    group: text("group"),
    benefits: jsonb("benefits").$type<string[]>(),
    entitlements: jsonb("entitlements").$type<Record<string, unknown>>(),
    limits: jsonb("limits").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("billing_plan_name_idx").on(table.name),
    uniqueIndex("billing_plan_stripePriceId_idx").on(table.stripePriceId),
    index("billing_plan_active_sort_idx").on(table.active, table.sortOrder),
  ],
);
