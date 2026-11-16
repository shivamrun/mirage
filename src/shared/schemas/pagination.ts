import {
  type PaginationMetadata,
  parseLimit,
  parsePage,
} from "@evensurface/paginate";
import { z } from "zod";

const paginationInputSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.union([z.string(), z.number()]).optional().catch(undefined),
);

export const paginationQuerySchema = z.object({
  limit: paginationInputSchema.transform((value) =>
    parseLimit(value, { defaultLimit: 10 }),
  ),
  page: paginationInputSchema.transform((value) => parsePage(value)),
});

export const paginationMetaSchema: z.ZodType<PaginationMetadata> = z.object({
  firstItem: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  lastItem: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  page: z.number().int().positive(),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export function paginatedResponseSchema<TItem extends z.ZodType>(
  itemSchema: TItem,
) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationMetaSchema,
  });
}
