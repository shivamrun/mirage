import type { NotifyInput } from "@/features/notifications";
import { emailNotificationChannel } from "@/features/notifications/channels/email";
import { inAppNotificationChannel } from "@/features/notifications/channels/in-app";
import type { NotificationDeliveryResult } from "@/features/notifications/channels/types";
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
import { publish } from "@/server/db/services/notifications/realtime-broker";
import { resolvePaginatedView } from "@/server/db/services/pagination";
import { notificationRealtimeEventNames } from "@/shared/schemas/notifications";

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

type NotifyResult = {
  deliveries: {
    email?: NotificationDeliveryResult["email"];
  };
  created: boolean;
  notification: NotificationRecord | null;
};

export async function notify<Type extends NotifyInput["type"]>(
  input: NotifyInput<Type>,
): Promise<NotifyResult> {
  const definition = getNotificationDefinition(input.type);
  const data = definition.payloadSchema.parse(input.data);
  const deliveryInput = {
    actorId: input.actorId,
    category: definition.category,
    data,
    idempotencyKey: input.idempotencyKey,
    recipientId: input.recipientId,
    subject: input.subject,
    type: input.type,
  };
  const deliveries: NotifyResult["deliveries"] = {};
  let notificationCreated = false;
  let notificationId: string | undefined;

  for (const channel of definition.channels) {
    const result: NotificationDeliveryResult =
      channel === "in_app"
        ? await inAppNotificationChannel.deliver(deliveryInput)
        : await emailNotificationChannel.deliver(deliveryInput);

    if (result.email) {
      deliveries.email = result.email;
    }

    if (result.notificationId) {
      notificationCreated = Boolean(result.notificationCreated);
      notificationId = result.notificationId;
    }
  }

  if (!notificationId) {
    return {
      created: false,
      deliveries,
      notification: null,
    };
  }

  if (!input.recipientId) {
    throw new Error("Created in-app notification is missing a recipientId.");
  }

  const notification = await getNotificationForRecipient({
    id: notificationId,
    recipientId: input.recipientId,
  });

  if (!notification) {
    throw new Error("Created notification could not be loaded.");
  }

  if (notificationCreated) {
    const unreadCount = await getUnreadNotificationCount({
      recipientId: input.recipientId,
    });

    publish(input.recipientId, {
      data: {
        notification: toNotificationResponse(notification),
        unreadCount,
      },
      event: notificationRealtimeEventNames.created,
    });
  }

  return {
    created: notificationCreated,
    deliveries,
    notification,
  };
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
  const notification = await markNotificationRead({ id, recipientId });
  if (notification) {
    await publishUnreadCountChanged(recipientId);
  }

  return notification;
}

export async function markUserNotificationUnread({
  id,
  recipientId,
}: {
  id: string;
  recipientId: string;
}) {
  const notification = await markNotificationUnread({ id, recipientId });
  if (notification) {
    await publishUnreadCountChanged(recipientId);
  }

  return notification;
}

export async function markUserNotificationsRead({
  recipientId,
}: {
  recipientId: string;
}) {
  const changedCount = await markAllNotificationsRead({ recipientId });
  if (changedCount > 0) {
    await publishUnreadCountChanged(recipientId);
  }
}

async function publishUnreadCountChanged(recipientId: string) {
  publish(recipientId, {
    data: {
      unreadCount: await getUnreadNotificationCount({ recipientId }),
    },
    event: notificationRealtimeEventNames.unreadCountChanged,
  });
}
