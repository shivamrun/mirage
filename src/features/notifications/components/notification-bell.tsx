import { BellIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUnreadNotificationCount } from "@/server/db/services/notifications/service";

export async function NotificationBell({ userId }: { userId: string }) {
  const unreadCount = await getUnreadNotificationCount({ recipientId: userId });
  const label =
    unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications";

  return (
    <Button asChild aria-label={label} size="icon-sm" variant="ghost">
      <Link className="relative" href="/account/notifications">
        <BellIcon />
        {unreadCount > 0 ? (
          <Badge className="-right-1 -top-1 absolute h-4 min-w-4 px-1 text-[10px] leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Link>
    </Button>
  );
}
