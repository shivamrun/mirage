import { z } from "zod";

import { statusSuccessResponseSchema } from "./api";

export const protectedRouteVerificationSchema = z.object({
  callbackURL: z.string({ error: "Invalid verification request." }).optional(),
});

export const protectedRouteVerificationResponseSchema =
  statusSuccessResponseSchema.extend({
    redirectURL: z.string(),
  });
