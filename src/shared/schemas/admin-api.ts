import { z } from "zod";

import { passthroughStatusSuccessResponseSchema } from "./api";
import {
  adminCreateEmailListSchema,
  emailListKeySchema,
  emailListStatusSchema,
} from "./email-list";
import { emailSchema } from "./helpers";

export const forcePasswordResetSchema = z.object({
  email: emailSchema,
});

const nonEmptyParamSchema = z.string().min(1);
const nullableTrimmedString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => value || null);

export const billingPlanParamsSchema = z.object({
  planId: z.uuid(),
});

const billingPlanBaseMutationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters.")
    .max(120, "Plan name must be 120 characters or fewer."),
  description: nullableTrimmedString,
  stripePriceId: z
    .string()
    .trim()
    .min(1, "Stripe price ID is required.")
    .max(120, "Stripe price ID must be 120 characters or fewer."),
  stripeAnnualDiscountPriceId: nullableTrimmedString,
  group: nullableTrimmedString,
  benefits: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Benefit cannot be empty.")
        .max(200, "Benefit must be 200 characters or fewer."),
    )
    .max(20, "A plan can list at most 20 benefits.")
    .nullable()
    .optional()
    .transform((value) => (value?.length ? value : null)),
  entitlements: z.record(z.string(), z.unknown()).nullable().optional(),
  limits: z.record(z.string(), z.unknown()).nullable().optional(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export const adminBillingPlanMutationSchema =
  billingPlanBaseMutationSchema.extend({
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  });

export const linkedAccountParamsSchema = z.object({
  accountRowId: nonEmptyParamSchema,
  userId: nonEmptyParamSchema,
});

export const userSessionParamsSchema = z.object({
  sessionId: nonEmptyParamSchema,
  userId: nonEmptyParamSchema,
});

export const emailListKeyParamsSchema = z.object({
  key: emailListKeySchema,
});

export const adminUpdateEmailListSchema = adminCreateEmailListSchema.omit({
  key: true,
});

export const adminUpdateBillingPlanSchema = billingPlanBaseMutationSchema
  .partial()
  .refine(
    (values) => Object.keys(values).length > 0,
    "At least one billing plan field must be provided.",
  );

export type AdminBillingPlanMutationValues = z.output<
  typeof adminBillingPlanMutationSchema
>;
export type AdminUpdateBillingPlanValues = z.output<
  typeof adminUpdateBillingPlanSchema
>;

export const emailListStatusUpdateBodySchema = z.object({
  status: emailListStatusSchema,
});

export const adminStatusResponseSchema = passthroughStatusSuccessResponseSchema;

export const adminPasswordResetSuccessResponseSchema =
  passthroughStatusSuccessResponseSchema.extend({
    message: z.string(),
    resetEmailDelivery: z.literal("unconfirmed"),
    revokedSessions: z.number(),
  });

export const adminPasswordResetPartialFailureResponseSchema = z.object({
  message: z.string(),
  resetEmailDelivery: z.literal("unconfirmed"),
  revokedSessions: z.number(),
  status: z.literal(false),
});

export const adminRevokeAllSessionsResponseSchema =
  passthroughStatusSuccessResponseSchema.extend({
    revokedSessions: z.number(),
  });
