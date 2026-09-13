import { z } from "zod";

import { passthroughStatusSuccessResponseSchema } from "./api";
import {
  adminCreateEmailListSchema,
  emailListKeySchema,
  emailListStatusSchema,
} from "./contact";
import { emailSchema } from "./helpers";

export const forcePasswordResetSchema = z.object({
  email: emailSchema,
});

const nonEmptyParamSchema = z.string().min(1);

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
