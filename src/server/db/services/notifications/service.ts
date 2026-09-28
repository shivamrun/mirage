import type { NotifyInput } from "@/features/notifications";
import { inAppNotificationChannel } from "@/features/notifications/channels/in-app";
import type { NotificationRecord } from "@/features/notifications/domain/types";
import {
  getNotificationDefinition,
  normalizeNotificationType,
} from "@/features/notifications/registry/registry";
import {
  countUnreadNotificationsForRecipient,
  getNotificationForRecipient,
  listNotificationsForRecipient,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/server/db/dal/notifications";
import { resolvePaginatedView } from "@/server/db/services/pagination";

function optionalDateToISOString(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function toNotificationResponse(notification: NotificationRecord) {
  return {
    ...notification,
    archivedAt: optionalDateToISOString(notification.archivedAt),
    createdAt: notification.createdAt.toISOString(),
    readAt: optionalDateToISOString(notification.readAt),
    seenAt: optionalDateToISOString(notification.seenAt),
    type: normalizeNotificationType(notification.type) ?? notification.type,
    updatedAt: notification.updatedAt.toISOString(),
  };
}

export async function notify<Type extends NotifyInput["type"]>(
  input: NotifyInput<Type>,
) {
  const definition = getNotificationDefinition(input.type);
  const data = definition.payloadSchema.parse(input.data);
  const result = await inAppNotificationChannel.deliver({
    actorId: input.actorId,
    category: definition.category,
    data,
    idempotencyKey: input.idempotencyKey,
    recipientId: input.recipientId,
    subject: input.subject,
    type: input.type,
  });

  const notification = await getNotificationForRecipient({
    id: result.notificationId,
    recipientId: input.recipientId,
  });

  if (!notification) {
    throw new Error("Created notification could not be loaded.");
  }

  return notification;
}

export async function notifyBestEffort<Type extends NotifyInput["type"]>(
  input: NotifyInput<Type>,
  context: string,
) {
  try {
    return await notify(input);
  } catch (error) {
    console.warn(`Unable to create notification (${context}):`, error);
    return null;
  }
}

export async function listNotificationsView({
  limit,
  page,
  recipientId,
}: {
  limit: number;
  page: number;
  recipientId: string;
}) {
  const result = await resolvePaginatedView({
    limit,
    page,
    loadPage: async ({ limit, offset }) => {
      const page = await listNotificationsForRecipient({
        limit,
        offset,
        recipientId,
      });

      return {
        items: page.notifications,
        total: page.total,
      };
    },
  });

  return {
    ...result.pagination,
    notifications: result.items,
  };
}

export async function getUnreadNotificationCount({
  recipientId,
}: {
  recipientId: string;
}) {
  return countUnreadNotificationsForRecipient({ recipientId });
}

export async function markUserNotificationRead({
  id,
  recipientId,
}: {
  id: string;
  recipientId: string;
}) {
  return markNotificationRead({ id, recipientId });
}

export async function markUserNotificationUnread({
  id,
  recipientId,
}: {
  id: string;
  recipientId: string;
}) {
  return markNotificationUnread({ id, recipientId });
}

export async function markUserNotificationsRead({
  recipientId,
}: {
  recipientId: string;
}) {
  await markAllNotificationsRead({ recipientId });
}
