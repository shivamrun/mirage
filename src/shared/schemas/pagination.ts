import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/shared/pagination";

const positiveIntegerFromQuery = z.preprocess((value) => {
  const firstValue = Array.isArray(value) ? value[0] : value;

  if (firstValue === undefined || firstValue === "") {
    return undefined;
  }

  return Number(firstValue);
}, z.number().int().positive().optional());

export const paginationQuerySchema = z.object({
  limit: positiveIntegerFromQuery
    .catch(DEFAULT_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
  page: positiveIntegerFromQuery.catch(DEFAULT_PAGE).default(DEFAULT_PAGE),
});

export const paginationMetaSchema = z.object({
  firstItem: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  lastItem: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  page: z.number().int().positive(),
  total: z.number().int().min(0),
  totalPages: z.number().int().positive(),
});

export function paginatedResponseSchema<TItem extends z.ZodType>(
  itemSchema: TItem,
) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationMetaSchema,
  });
}

export type PaginationQuery = z.output<typeof paginationQuerySchema>;
export type PaginationMetaValues = z.output<typeof paginationMetaSchema>;
