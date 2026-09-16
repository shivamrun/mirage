import { prepareUploadOutputSchema } from "@marinedotsh/upload-sdk";
import { z } from "zod";

import { uploadAssetKeys } from "@/lib/uploads/asset-keys";

import { messageResponseSchema } from "./api";

export const uploadAssetKeySchema = z.enum(uploadAssetKeys, {
  error: "Invalid upload key.",
});

export const prepareUploadRequestSchema = z.object({
  contentType: z.string().min(1, "Content type is required."),
  filename: z.string().min(1, "Filename is required."),
  key: uploadAssetKeySchema,
  size: z
    .number({
      error: "Size must be a positive integer.",
    })
    .int("Size must be a positive integer.")
    .min(1, "Size must be a positive integer."),
});

export const prepareUploadResponseSchema = z.object({
  key: z.string(),
  publicUrl: z.string(),
  upload: prepareUploadOutputSchema,
});

export const uploadErrorResponseSchema = messageResponseSchema.extend({
  code: z.string().optional(),
});

export type PrepareUploadResponse = z.infer<typeof prepareUploadResponseSchema>;
