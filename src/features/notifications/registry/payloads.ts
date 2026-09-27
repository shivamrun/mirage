import { z } from "zod";

export const notificationPayloadSchemas = {
  ACCOUNT_EMAIL_CHANGED: z.object({
    email: z.string().email(),
  }),
  ACCOUNT_SECURITY_ALERT: z.object({
    action: z.string().trim().min(1),
    ipAddress: z.string().trim().optional(),
  }),
  BILLING_PAYMENT_FAILED: z.object({
    invoiceId: z.string().trim().min(1),
    plan: z.string().trim().min(1).optional(),
  }),
  CREDITS_LOW_BALANCE: z.object({
    balance: z.number().int().min(0),
    threshold: z.number().int().min(0),
  }),
  SYSTEM_ANNOUNCEMENT: z.object({
    message: z.string().trim().min(1),
    title: z.string().trim().min(1),
    url: z.string().trim().optional(),
  }),
} as const;
