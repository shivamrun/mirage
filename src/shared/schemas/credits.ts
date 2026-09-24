import { z } from "zod";

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
