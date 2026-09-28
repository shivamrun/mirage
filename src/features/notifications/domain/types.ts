import type { z } from "zod";

import type { notificationPayloadSchemas } from "../registry/payloads";
import type { notificationRegistry } from "../registry/registry";

export type NotificationType = keyof typeof notificationRegistry;

export type NotificationCategory =
  (typeof notificationRegistry)[NotificationType]["category"];

export type NotificationChannel = "email" | "in_app";

export type NotificationPayloadMap = {
  [Type in keyof typeof notificationPayloadSchemas]: z.infer<
    (typeof notificationPayloadSchemas)[Type]
  >;
};

export type NotificationSubject = {
  id: string;
  type: string;
};

type NotificationTypesForChannel<Channel extends NotificationChannel> = {
  [Type in NotificationType]: Channel extends (typeof notificationRegistry)[Type]["channels"][number]
    ? Type
    : never;
}[NotificationType];

type BaseNotifyInput<Type extends NotificationType> = {
  actorId?: null | string;
  data: NotificationPayloadMap[Type];
  idempotencyKey?: null | string;
  subject?: null | NotificationSubject;
  type: Type;
};

export type NotifyInput<Type extends NotificationType = NotificationType> =
  Type extends NotificationType
    ? BaseNotifyInput<Type> &
        (Type extends NotificationTypesForChannel<"in_app">
          ? { recipientId: string }
          : { recipientId?: string })
    : never;

export type NotificationRecord = {
  actorId: null | string;
  archivedAt: Date | null;
  category: NotificationCategory;
  createdAt: Date;
  data: NotificationPayloadMap[NotificationType];
  id: string;
  idempotencyKey: null | string;
  readAt: Date | null;
  recipientId: string;
  seenAt: Date | null;
  subjectId: null | string;
  subjectType: null | string;
  type: NotificationType;
  updatedAt: Date;
};
