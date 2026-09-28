import type { SendEmailResult } from "@/adapters/email";

import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPayloadMap,
  NotificationSubject,
  NotificationType,
} from "../domain/types";

export type NotificationDeliveryInput<
  Type extends NotificationType = NotificationType,
> = {
  actorId?: null | string;
  category: NotificationCategory;
  data: NotificationPayloadMap[Type];
  idempotencyKey?: null | string;
  recipientId?: string;
  subject?: null | NotificationSubject;
  type: Type;
};

export type NotificationDeliveryResult = {
  email?: SendEmailResult;
  notificationCreated?: boolean;
  notificationId?: string;
};

export type NotificationChannelHandler = {
  channel: NotificationChannel;
  deliver: (
    input: NotificationDeliveryInput,
  ) => Promise<NotificationDeliveryResult>;
};
