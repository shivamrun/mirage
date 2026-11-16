import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { NotificationRealtimeTestButton } from "@/features/notifications/components/notification-realtime-test-button";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationsPageSearchParams,
  notificationsHrefFromSearchParams,
  notificationsPageHref,
  notificationsRawHrefFromSearchParams,
  parseNotificationsSearchParams,
} from "@/features/notifications/query/notifications-query";
import { requireAuth } from "@/server/db/services/auth/access";
import {
  getUnreadNotificationCount,
  listNotificationsView,
} from "@/server/db/services/notifications/service";
import { getPageMetadata } from "@/shared/metadata";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "./actions";

export const metadata = getPageMetadata("Notifications", {
  path: "/account/notifications",
});

type NotificationsPageProps = {
  searchParams: Promise<NotificationsPageSearchParams>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const canonicalHref = notificationsHrefFromSearchParams(params);
  const requestHeaders = await headers();
  const user = await requireAuth({ headers: requestHeaders });

  if (notificationsRawHrefFromSearchParams(params) !== canonicalHref) {
    redirect(canonicalHref);
  }

  const { page } = parseNotificationsSearchParams(params);
  const result = await listNotificationsView({
    limit: NOTIFICATIONS_PAGE_SIZE,
    page,
    recipientId: user.id,
  });
  const unreadCount = await getUnreadNotificationCount({
    recipientId: user.id,
  });

  if (page !== result.pagination.page) {
    redirect(notificationsPageHref({ page: result.pagination.page }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Review account, billing, product, and system updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {process.env.NODE_ENV !== "production" ? (
            <NotificationRealtimeTestButton />
          ) : null}
          <form action={markAllNotificationsReadAction}>
            <Button
              disabled={unreadCount === 0}
              type="submit"
              variant="outline"
            >
              Mark all read
            </Button>
          </form>
        </div>
      </header>

      <NotificationList
        markReadAction={markNotificationReadAction}
        markUnreadAction={markNotificationUnreadAction}
        notifications={result.items}
      />

      <Pagination
        entityLabel="notifications"
        getPageHref={(page) => notificationsPageHref({ page })}
        pagination={result.pagination}
      />
    </div>
  );
}
