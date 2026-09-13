import { z } from "zod";

import { statusSuccessResponseSchema } from "./api";
import { emailSchema } from "./helpers";

export const CONTACT_MESSAGE_MAX_LENGTH = 2000;
export const EMAIL_LIST_KEY_MAX_LENGTH = 80;
export const EMAIL_LIST_NAME_MAX_LENGTH = 120;
export const EMAIL_LIST_DESCRIPTION_MAX_LENGTH = 500;
export const EMAIL_LIST_SOURCE_MAX_LENGTH = 120;

export const emailListKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "List key must be at least 2 characters.")
  .max(
    EMAIL_LIST_KEY_MAX_LENGTH,
    `List key must be ${EMAIL_LIST_KEY_MAX_LENGTH} characters or fewer.`,
  )
  .regex(
    /^[a-z0-9][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)?$/,
    "List key can use lowercase letters, numbers, underscores, dashes, and one namespace colon.",
  );

export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name must be 100 characters or fewer."),
  email: emailSchema,
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .nullable()
    .optional()
    .transform((value) => value || null),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(
      CONTACT_MESSAGE_MAX_LENGTH,
      `Message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer.`,
    ),
  website: z.string().optional(),
});

export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
export type ContactSubmissionValues = z.output<typeof contactSubmissionSchema>;

export const contactSuccessResponseSchema = statusSuccessResponseSchema;

export const emailSubscriptionSchema = z.object({
  email: emailSchema,
  listKey: emailListKeySchema,
  source: z
    .string()
    .trim()
    .max(
      EMAIL_LIST_SOURCE_MAX_LENGTH,
      `Source must be ${EMAIL_LIST_SOURCE_MAX_LENGTH} characters or fewer.`,
    )
    .nullable()
    .optional()
    .transform((value) => value || null),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  website: z.string().optional(),
});

export type EmailSubscriptionInput = z.input<typeof emailSubscriptionSchema>;
export type EmailSubscriptionValues = z.output<typeof emailSubscriptionSchema>;

export const emailListSignupSuccessResponseSchema =
  statusSuccessResponseSchema.extend({
    verificationRequired: z.boolean().optional(),
  });

export const emailListVerifyQuerySchema = z.object({
  token: z.string().optional(),
});

export const emailListStatusSchema = z.enum(["active", "archived"]);
export const emailSubscriptionStatusSchema = z.enum([
  "subscribed",
  "unsubscribed",
  "pending",
  "bounced",
]);

export const adminCreateEmailListSchema = z.object({
  key: emailListKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(
      EMAIL_LIST_NAME_MAX_LENGTH,
      `Name must be ${EMAIL_LIST_NAME_MAX_LENGTH} characters or fewer.`,
    ),
  description: z
    .string()
    .trim()
    .max(
      EMAIL_LIST_DESCRIPTION_MAX_LENGTH,
      `Description must be ${EMAIL_LIST_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
    .nullable()
    .optional()
    .transform((value) => value || null),
  emailVerificationRequired: z.boolean().default(false),
});

export const adminEmailSubscriberSearchParamsSchema = z.object({
  listKey: emailListKeySchema.optional().catch(undefined),
  query: z.string().trim().catch("").default(""),
  status: emailSubscriptionStatusSchema.optional().catch(undefined),
});

export type EmailListStatus = z.infer<typeof emailListStatusSchema>;
export type EmailSubscriptionStatus = z.infer<
  typeof emailSubscriptionStatusSchema
>;
export type AdminCreateEmailListInput = z.input<
  typeof adminCreateEmailListSchema
>;
export type AdminCreateEmailListValues = z.output<
  typeof adminCreateEmailListSchema
>;
export type AdminEmailSubscriberQueryState = z.output<
  typeof adminEmailSubscriberSearchParamsSchema
>;
