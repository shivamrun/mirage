import { paginateDrizzle } from "@evensurface/paginate-drizzle";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { NotificationRecord } from "@/features/notifications";
import type { NotificationDeliveryInput } from "@/features/notifications/channels/types";
import db from "@/server/db";
import { notification } from "@/server/db/schema";

type ListNotificationsOptions = {
  limit: number;
  page: number;
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
    return {
      created: true,
      notification: asNotificationRecord(created),
    };
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

  return {
    created: false,
    notification: asNotificationRecord(existing),
  };
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
  page,
  recipientId,
}: ListNotificationsOptions) {
  const whereClause = eq(notification.recipientId, recipientId);

  const result = await paginateDrizzle({
    countQuery: db.$count(notification, whereClause),
    limit,
    page,
    query: () =>
      db
        .select(notificationSelection)
        .from(notification)
        .where(whereClause)
        .orderBy(desc(notification.createdAt), asc(notification.id)),
  });

  return {
    items: result.items.map((item) => item satisfies NotificationRecord),
    pagination: result.pagination,
  };
}

export async function countUnreadNotificationsForRecipient({
  recipientId,
}: {
  recipientId: string;
}) {
  return db.$count(
    notification,
    and(eq(notification.recipientId, recipientId), isNull(notification.readAt)),
  );
}

export async function markNotificationRead({
  id,
  recipientId,
}: NotificationOwnerOptions) {
  const [row] = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.id, id),
        eq(notification.recipientId, recipientId),
        isNull(notification.readAt),
      ),
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
      and(
        eq(notification.id, id),
        eq(notification.recipientId, recipientId),
        isNotNull(notification.readAt),
      ),
    )
    .returning(notificationSelection);

  return row ? (row satisfies NotificationRecord) : null;
}

export async function markAllNotificationsRead({
  recipientId,
}: {
  recipientId: string;
}) {
  const rows = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.recipientId, recipientId),
        isNull(notification.readAt),
      ),
    )
    .returning({ id: notification.id });

  return rows.length;
}
