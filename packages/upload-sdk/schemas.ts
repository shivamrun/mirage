import * as z from "zod";

import type {
  MultipartUploadPart,
  PrepareMultipartUploadPartsOutput,
  PrepareUploadOutput,
} from "./types";

export const prepareUploadOutputSchema = z.object({
  expiresAt: z.string(),
  fields: z.record(z.string(), z.string()),
  headers: z.record(z.string(), z.string()),
  key: z.string(),
  method: z.literal("POST"),
  strategy: z.literal("multipart"),
  url: z.string(),
}) satisfies z.ZodType<PrepareUploadOutput>;

export const multipartUploadPartSchema = z.object({
  expiresAt: z.string(),
  headers: z.record(z.string(), z.string()),
  method: z.literal("PUT"),
  partNumber: z.number().int(),
  url: z.string(),
}) satisfies z.ZodType<MultipartUploadPart>;

export const prepareMultipartUploadPartsOutputSchema = z.object({
  key: z.string(),
  parts: z.array(multipartUploadPartSchema),
  storageProfile: z.string(),
  strategy: z.literal("multipart-parts"),
  uploadId: z.string(),
}) satisfies z.ZodType<PrepareMultipartUploadPartsOutput>;
