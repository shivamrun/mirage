import { z } from "zod";

export const contactSubmissionStatusValues = [
  "new",
  "read",
  "archived",
] as const;

export const contactSubmissionStatusSchema = z.enum(
  contactSubmissionStatusValues,
);

export const adminContactSubmissionSearchParamsSchema = z.object({
  filterField: z.literal("status").optional().catch(undefined),
  filterValue: contactSubmissionStatusSchema
    .or(z.literal(""))
    .optional()
    .catch("")
    .default(""),
  q: z.string().trim().catch("").default(""),
});

export const updateContactSubmissionStatusActionSchema = z.object({
  id: z.string().trim().min(1),
  status: contactSubmissionStatusSchema,
});

export const bulkUpdateContactSubmissionStatusActionSchema =
  adminContactSubmissionSearchParamsSchema.extend({
    fromStatus: contactSubmissionStatusSchema.optional().catch(undefined),
    status: contactSubmissionStatusSchema,
  });

export type ContactSubmissionStatus = z.infer<
  typeof contactSubmissionStatusSchema
>;
export type AdminContactSubmissionSearchParams = z.input<
  typeof adminContactSubmissionSearchParamsSchema
>;
