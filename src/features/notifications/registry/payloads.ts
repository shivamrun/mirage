import { z } from "zod";

export const notificationPayloadSchemas = {
  "account.email_changed": z.object({
    email: z.string().email(),
  }),
  "account.email_change_requested": z.object({
    email: z.string().email(),
  }),
  "billing.credit_top_up_completed": z.object({
    amount: z.number().int().positive(),
  }),
  "billing.payment_failed": z.object({
    invoiceId: z.string().trim().min(1),
    plan: z.string().trim().min(1).optional(),
  }),
  "billing.subscription_canceled": z.object({
    cancelAtPeriodEnd: z.boolean(),
    plan: z.string().trim().min(1),
  }),
  "billing.subscription_started": z.object({
    interval: z.string().trim().min(1).optional(),
    plan: z.string().trim().min(1),
  }),
  "billing.subscription_updated": z.object({
    interval: z.string().trim().min(1).optional(),
    plan: z.string().trim().min(1),
    status: z.string().trim().min(1).optional(),
  }),
  "credits.low_balance": z.object({
    balance: z.number().int().min(0),
    threshold: z.number().int().min(0),
  }),
  "security.account_alert": z.object({
    action: z.string().trim().min(1),
    ipAddress: z.string().trim().optional(),
  }),
  "system.announcement": z.object({
    message: z.string().trim().min(1),
    title: z.string().trim().min(1),
    url: z.string().trim().optional(),
  }),
} as const;
