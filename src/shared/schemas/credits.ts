import { z } from "zod";

import { creditSampleItemKeys } from "@/shared/credits/sample-catalog";

const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .max(200, "Source ID must be 200 characters or fewer.")
  .optional()
  .transform((value) => value || undefined);

export const creditLedgerEntryResponseSchema = z.object({
  id: z.uuid(),
  amount: z.number().int(),
  type: z.string(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  idempotencyKey: z.string(),
  source: z.string(),
  sourceId: z.string().nullable(),
  reversesLedgerEntryId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export const creditBalanceResponseSchema = z.object({
  availableCredits: z.number().int(),
  carryForwardCredits: z.number().int(),
  lifetimeGranted: z.number().int(),
  lifetimeSpent: z.number().int(),
  lifetimeExpired: z.number().int(),
  currentPeriod: z.object({
    allowance: z.number().int(),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    plan: z.string(),
  }),
  recentLedger: z.array(creditLedgerEntryResponseSchema),
});

export const creditSampleCreateRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  itemKey: z.enum(creditSampleItemKeys, {
    error: "Choose a valid credit sample item.",
  }),
});

export const creditSampleCreatedEntrySchema = z.object({
  body: z.string(),
  creditsSpent: z.number().int(),
  itemKey: z.string(),
  title: z.string(),
});

export const creditSampleCreateResponseSchema = z.object({
  balance: creditBalanceResponseSchema,
  created: creditSampleCreatedEntrySchema,
});

export const creditTopUpCheckoutResponseSchema = z.object({
  url: z.string().url(),
});

export const adminCreditAdjustmentSchema = z.object({
  amount: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z
      .number({
        error: "Credit adjustment amount must be a number.",
      })
      .int("Credit adjustment amount must be a whole number.")
      .refine((value) => value !== 0, {
        message: "Credit adjustment amount cannot be zero.",
      }),
  ),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required.")
    .max(500, "Reason must be 500 characters or fewer."),
  sourceId: optionalTrimmedStringSchema,
});

export type AdminCreditAdjustmentInput = z.input<
  typeof adminCreditAdjustmentSchema
>;
export type AdminCreditAdjustmentValues = z.output<
  typeof adminCreditAdjustmentSchema
>;
export type CreditBalanceResponse = z.infer<typeof creditBalanceResponseSchema>;
export type CreditSampleCreateInput = z.input<
  typeof creditSampleCreateRequestSchema
>;
export type CreditSampleCreateResponse = z.infer<
  typeof creditSampleCreateResponseSchema
>;
export type CreditTopUpCheckoutResponse = z.infer<
  typeof creditTopUpCheckoutResponseSchema
>;
