import { createNotification } from "@/server/db/dal/notifications";

import type { NotificationChannelHandler } from "../types";

export const inAppNotificationChannel = {
  channel: "in_app",
  async deliver(input) {
    if (!input.recipientId) {
      throw new Error("In-app notifications require a recipientId.");
    }

    const notification = await createNotification({
      ...input,
      recipientId: input.recipientId,
    });

    return {
      notificationId: notification.id,
    };
  },
} satisfies NotificationChannelHandler;
