import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { NotificationRecord } from "@/features/notifications";
import type { NotificationDeliveryInput } from "@/features/notifications/channels/types";
import db from "@/server/db";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import { notification } from "@/server/db/schema";

type ListNotificationsOptions = {
  limit: number;
  offset: number;
  recipientId: string;
};

type NotificationOwnerOptions = {
  id: string;
  recipientId: string;
};

const notificationSelection = {
  actorId: notification.actorId,
  archivedAt: notification.archivedAt,
  category: notification.category,
  createdAt: notification.createdAt,
  data: notification.data,
  id: notification.id,
  idempotencyKey: notification.idempotencyKey,
  readAt: notification.readAt,
  recipientId: notification.recipientId,
  seenAt: notification.seenAt,
  subjectId: notification.subjectId,
  subjectType: notification.subjectType,
  type: notification.type,
  updatedAt: notification.updatedAt,
};

function asNotificationRecord(row: typeof notification.$inferSelect) {
  return row satisfies NotificationRecord;
}

export async function createNotification(
  input: NotificationDeliveryInput & { recipientId: string },
) {
  const [created] = await db
    .insert(notification)
    .values({
      actorId: input.actorId ?? null,
      category: input.category,
      data: input.data,
      idempotencyKey: input.idempotencyKey ?? null,
      recipientId: input.recipientId,
      subjectId: input.subject?.id ?? null,
      subjectType: input.subject?.type ?? null,
      type: input.type,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return asNotificationRecord(created);
  }

  if (!input.idempotencyKey) {
    throw new Error(
      "Notification creation failed without idempotency conflict.",
    );
  }

  const [existing] = await db
    .select()
    .from(notification)
    .where(eq(notification.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (!existing) {
    throw new Error("Notification idempotency conflict could not be resolved.");
  }

  return asNotificationRecord(existing);
}

export async function getNotificationForRecipient({
  id,
  recipientId,
}: NotificationOwnerOptions) {
  const [row] = await db
    .select(notificationSelection)
    .from(notification)
    .where(
      and(eq(notification.id, id), eq(notification.recipientId, recipientId)),
    )
    .limit(1);

  return row ? (row satisfies NotificationRecord) : null;
}

export async function listNotificationsForRecipient({
  limit,
  offset,
  recipientId,
}: ListNotificationsOptions) {
  const whereClause = eq(notification.recipientId, recipientId);
  const result = await paginateList({
    countQuery: db
      .select({ total: totalCount })
      .from(notification)
      .where(whereClause),
    limit,
    offset,
    query: db
      .select(notificationSelection)
      .from(notification)
      .where(whereClause)
      .orderBy(desc(notification.createdAt), asc(notification.id)),
  });

  return {
    limit,
    notifications: result.items.map(
      (item) => item satisfies NotificationRecord,
    ),
    offset,
    total: result.total,
  };
}

export async function countUnreadNotificationsForRecipient({
  recipientId,
}: {
  recipientId: string;
}) {
  const [row] = await db
    .select({ total: totalCount })
    .from(notification)
    .where(
      and(
        eq(notification.recipientId, recipientId),
        isNull(notification.readAt),
      ),
    );

  return row?.total ?? 0;
}

export async function markNotificationRead({
  id,
  recipientId,
}: NotificationOwnerOptions) {
  const [row] = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(eq(notification.id, id), eq(notification.recipientId, recipientId)),
    )
    .returning(notificationSelection);

  return row ? (row satisfies NotificationRecord) : null;
}

export async function markNotificationUnread({
  id,
  recipientId,
}: NotificationOwnerOptions) {
  const [row] = await db
    .update(notification)
    .set({ readAt: null })
    .where(
      and(eq(notification.id, id), eq(notification.recipientId, recipientId)),
    )
    .returning(notificationSelection);

  return row ? (row satisfies NotificationRecord) : null;
}

export async function markAllNotificationsRead({
  recipientId,
}: {
  recipientId: string;
}) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.recipientId, recipientId),
        isNull(notification.readAt),
      ),
    );
}
