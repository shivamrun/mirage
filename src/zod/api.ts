import { z } from "zod";

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const statusSuccessResponseSchema = z.object({
  status: z.literal(true),
});

export const passthroughStatusSuccessResponseSchema =
  statusSuccessResponseSchema.passthrough();
