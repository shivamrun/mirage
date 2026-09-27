"use server";

import { revalidatePath } from "next/cache";

import { NOTIFICATIONS_PAGE_PATH } from "@/features/notifications/query/notifications-query";
import { requireAuth } from "@/server/db/services/auth/access";
import {
  markUserNotificationRead,
  markUserNotificationsRead,
  markUserNotificationUnread,
} from "@/server/db/services/notifications/service";
import { notificationActionSchema } from "@/shared/schemas/notifications";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireAuth();
  const { id } = notificationActionSchema.parse({
    id: formString(formData, "id"),
  });

  await markUserNotificationRead({ id, recipientId: user.id });
  revalidatePath(NOTIFICATIONS_PAGE_PATH);
}

export async function markNotificationUnreadAction(formData: FormData) {
  const user = await requireAuth();
  const { id } = notificationActionSchema.parse({
    id: formString(formData, "id"),
  });

  await markUserNotificationUnread({ id, recipientId: user.id });
  revalidatePath(NOTIFICATIONS_PAGE_PATH);
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuth();

  await markUserNotificationsRead({ recipientId: user.id });
  revalidatePath(NOTIFICATIONS_PAGE_PATH);
}
