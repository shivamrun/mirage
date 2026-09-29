import { z } from "zod";

import {
  passthroughStatusSuccessResponseSchema,
  statusSuccessResponseSchema,
} from "./api";
import { changeEmailSchema, emailChangeTokenSchema } from "./auth-forms";

export const twoFactorEmailCodeActionSchema = z.object({
  action: z.enum(["enable", "disable"]),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().min(1),
});

export const emailChangeRedirectQuerySchema = z.object({
  token: z.string().optional(),
});

export const changeAccountEmailBodySchema = changeEmailSchema.omit({
  callbackURL: true,
});

export const pendingEmailStepSchema = z.enum(["approve-current", "verify-new"]);

export const accountEmailStateResponseSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
  pendingEmail: z.string().nullable(),
  pendingEmailExpiresAt: z.string().nullable(),
  pendingEmailStep: pendingEmailStepSchema.nullable(),
});

export const accountEmailMutationResponseSchema =
  accountEmailStateResponseSchema.extend({
    status: z.literal(true),
  });

export const twoFactorEmailCodeResponseSchema =
  passthroughStatusSuccessResponseSchema;

export const twoFactorStartSetupResponseSchema =
  statusSuccessResponseSchema.extend({
    totpURI: z.string(),
  });

export const twoFactorEnabledResponseSchema =
  statusSuccessResponseSchema.extend({
    twoFactorEnabled: z.boolean(),
  });

export const accountRedirectResponseSchema = statusSuccessResponseSchema
  .extend({
    redirectURL: z.string(),
  })
  .passthrough();

export const emailChangeApprovalRecoveryResponseSchema = z.object({
  message: z.string(),
  recovery: z.literal("resend-from-account"),
});

export const twoFactorDeliveryRecoveryResponseSchema = z.object({
  message: z.string(),
  retryAfterSeconds: z.number().optional(),
  recovery: z.string(),
});

export { emailChangeTokenSchema };
