import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { presentNotification } from "@/features/notifications/registry/presentation";
import type { NotificationRecord } from "../domain/types";

type NotificationAction = (formData: FormData) => Promise<void>;

function NotificationRow({
  markReadAction,
  markUnreadAction,
  notification,
}: {
  markReadAction: NotificationAction;
  markUnreadAction: NotificationAction;
  notification: NotificationRecord;
}) {
  const presentation = presentNotification(notification);
  const isUnread = !notification.readAt;
  const createdAt =
    notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt);

  return (
    <li className="flex min-w-0 items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {presentation.href ? (
            <Link
              className="link-text font-medium text-foreground"
              href={presentation.href}
            >
              {presentation.title}
            </Link>
          ) : (
            <p className="font-medium">{presentation.title}</p>
          )}
          {isUnread ? <Badge variant="secondary">Unread</Badge> : null}
        </div>

        <p className="mt-1 text-muted-foreground text-sm">
          {presentation.description}
        </p>
        <p className="mt-2 text-muted-foreground text-xs">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </p>
      </div>

      <form action={isUnread ? markReadAction : markUnreadAction}>
        <input name="id" type="hidden" value={notification.id} />
        <Button size="sm" type="submit" variant="outline">
          {isUnread ? "Mark read" : "Mark unread"}
        </Button>
      </form>
    </li>
  );
}

export function NotificationList({
  markReadAction,
  markUnreadAction,
  notifications,
}: {
  markReadAction: NotificationAction;
  markUnreadAction: NotificationAction;
  notifications: NotificationRecord[];
}) {
  if (notifications.length === 0) {
    return (
      <Empty className="min-h-80 border">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>No notifications</EmptyTitle>
          <EmptyDescription>
            Account, billing, product, and system updates will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-hidden rounded-lg border px-4">
      {notifications.map((notification) => (
        <NotificationRow
          key={notification.id}
          markReadAction={markReadAction}
          markUnreadAction={markUnreadAction}
          notification={notification}
        />
      ))}
    </ul>
  );
}
