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

const notificationDataSchemas = Object.values(notificationPayloadSchemas) as [
  (typeof notificationPayloadSchemas)[keyof typeof notificationPayloadSchemas],
  ...(typeof notificationPayloadSchemas)[keyof typeof notificationPayloadSchemas][],
];

export const notificationResponseSchema = z.object({
  actorId: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  category: notificationCategorySchema,
  createdAt: z.iso.datetime(),
  data: z.union(notificationDataSchemas),
  id: z.string(),
  idempotencyKey: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  recipientId: z.string(),
  seenAt: z.iso.datetime().nullable(),
  subjectId: z.string().nullable(),
  subjectType: z.string().nullable(),
  type: notificationTypeSchema,
  updatedAt: z.iso.datetime(),
});

export const notificationRealtimeEventNames = {
  connected: "notifications.connected",
  created: "notification.created",
  ping: "ping",
  resync: "notifications.resync",
  unreadCountChanged: "notifications.unread_count_changed",
} as const;

export const notificationRealtimeRetryMs = 5_000;

export const notificationRealtimeConnectedEventSchema = z.object({
  unreadCount: z.number().int().min(0),
});

export const notificationRealtimeCreatedEventSchema = z.object({
  notification: notificationResponseSchema,
  unreadCount: z.number().int().min(0),
});

export const notificationRealtimeUnreadCountChangedEventSchema = z.object({
  unreadCount: z.number().int().min(0),
});

export const notificationRealtimeResyncEventSchema = z.object({});

export const notificationRealtimePingEventSchema = z.object({});

export const notificationRealtimeEventSchema = z.discriminatedUnion("event", [
  z.object({
    data: notificationRealtimeConnectedEventSchema,
    event: z.literal(notificationRealtimeEventNames.connected),
  }),
  z.object({
    data: notificationRealtimeCreatedEventSchema,
    event: z.literal(notificationRealtimeEventNames.created),
  }),
  z.object({
    data: notificationRealtimeUnreadCountChangedEventSchema,
    event: z.literal(notificationRealtimeEventNames.unreadCountChanged),
  }),
  z.object({
    data: notificationRealtimeResyncEventSchema,
    event: z.literal(notificationRealtimeEventNames.resync),
  }),
  z.object({
    data: notificationRealtimePingEventSchema,
    event: z.literal(notificationRealtimeEventNames.ping),
  }),
]);

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
export type NotificationRealtimeEvent = z.infer<
  typeof notificationRealtimeEventSchema
>;
