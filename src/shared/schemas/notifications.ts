import { z } from "zod";

import { notificationPayloadSchemas } from "@/features/notifications/registry/payloads";
import { notificationRegistry } from "@/features/notifications/registry/registry";
import { paginatedResponseSchema } from "./pagination";

export const notificationTypeSchema = z.enum(
  Object.keys(notificationRegistry) as [
    keyof typeof notificationRegistry,
    ...(keyof typeof notificationRegistry)[],
  ],
);

export const notificationCategorySchema = z.enum([
  "account",
  "billing",
  "product",
  "security",
  "system",
]);

export const notificationChannelSchema = z.literal("in_app");

export const notificationSubjectSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

export const notificationResponseSchema = z.object({
  actorId: z.string().nullable(),
  archivedAt: z.date().nullable(),
  category: notificationCategorySchema,
  createdAt: z.date(),
  data: z.union([
    notificationPayloadSchemas.ACCOUNT_EMAIL_CHANGED,
    notificationPayloadSchemas.ACCOUNT_SECURITY_ALERT,
    notificationPayloadSchemas.BILLING_PAYMENT_FAILED,
    notificationPayloadSchemas.CREDITS_LOW_BALANCE,
    notificationPayloadSchemas.SYSTEM_ANNOUNCEMENT,
  ]),
  id: z.string(),
  idempotencyKey: z.string().nullable(),
  readAt: z.date().nullable(),
  recipientId: z.string(),
  seenAt: z.date().nullable(),
  subjectId: z.string().nullable(),
  subjectType: z.string().nullable(),
  type: notificationTypeSchema,
  updatedAt: z.date(),
});

export const notificationsListResponseSchema = paginatedResponseSchema(
  notificationResponseSchema,
);

export const unreadNotificationCountResponseSchema = z.object({
  unreadCount: z.number().int().min(0),
});

export const notificationMutationResponseSchema = z.object({
  notification: notificationResponseSchema.nullable(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const notificationActionSchema = notificationIdParamsSchema;

export type NotificationActionValues = z.infer<typeof notificationActionSchema>;
