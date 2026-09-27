import { createNotification } from "@/server/db/dal/notifications";

import type { NotificationChannelHandler } from "../types";

export const inAppNotificationChannel = {
  channel: "in_app",
  async deliver(input) {
    const notification = await createNotification(input);

    return {
      notificationId: notification.id,
    };
  },
} satisfies NotificationChannelHandler;
