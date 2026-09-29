import { z } from "zod";

export const notificationPayloadSchemas = {
  "account.email_changed": z.object({
    email: z.string().email(),
  }),
  "account.email_change_requested": z.object({
    email: z.string().email(),
  }),
  "account.two_factor_email_code": z.object({
    action: z.enum(["enable", "disable"]),
    code: z.string().trim().min(1),
    email: z.string().email(),
    name: z.string().trim().nullable().optional(),
  }),
  "auth.email_verification": z.object({
    actionLabel: z.string().trim().min(1).optional(),
    email: z.string().email(),
    heading: z.string().trim().min(1).optional(),
    intro: z.string().trim().min(1).optional(),
    name: z.string().trim().nullable().optional(),
    verificationUrl: z.string().url(),
  }),
  "auth.password_reset": z.object({
    email: z.string().email(),
    name: z.string().trim().nullable().optional(),
    resetUrl: z.string().url(),
  }),
  "auth.welcome": z.object({
    appUrl: z.string().url().optional(),
    email: z.string().email(),
    name: z.string().trim().nullable().optional(),
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
  "email_list.verification": z.object({
    email: z.string().email(),
    listKey: z.string().trim().min(1),
    listName: z.string().trim().min(1),
    verificationUrl: z.string().url(),
  }),
  "referrals.completed": z.object({
    creditAmount: z.number().int().positive(),
    referredUserEmail: z.string().email(),
    referredUserName: z.string().trim().nullable().optional(),
    referrerEmail: z.string().email(),
    referrerName: z.string().trim().nullable().optional(),
  }),
  "referrals.signup_recorded": z.object({
    referredUserEmail: z.string().email(),
    referredUserName: z.string().trim().nullable().optional(),
  }),
  "security.account_alert": z.object({
    action: z.string().trim().min(1),
    ipAddress: z.string().trim().optional(),
  }),
} as const;
