import { z } from "zod";

import { statusSuccessResponseSchema } from "./api";
import { emailSchema } from "./helpers";

export const CONTACT_MESSAGE_MAX_LENGTH = 2000;

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
  turnstileToken: z.string().trim().optional(),
  website: z.string().optional(),
});

export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;
export type ContactSubmissionValues = z.output<typeof contactSubmissionSchema>;

export const contactSuccessResponseSchema = statusSuccessResponseSchema;
