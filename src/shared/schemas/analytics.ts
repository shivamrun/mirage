import { z } from "zod";

const analyticsAttributionValueSchema = z.string().trim().min(1).max(120);

export const analyticsAttributionSchema = z
  .object({
    creator: analyticsAttributionValueSchema.optional(),
    landingPath: analyticsAttributionValueSchema.optional(),
    referrerDomain: analyticsAttributionValueSchema.optional(),
    utmCampaign: analyticsAttributionValueSchema.optional(),
    utmContent: analyticsAttributionValueSchema.optional(),
    utmMedium: analyticsAttributionValueSchema.optional(),
    utmSource: analyticsAttributionValueSchema.optional(),
    utmTerm: analyticsAttributionValueSchema.optional(),
  })
  .strict()
  .optional();

export type AnalyticsAttributionInput = z.input<
  typeof analyticsAttributionSchema
>;
export type AnalyticsAttributionValues = z.output<
  typeof analyticsAttributionSchema
>;
