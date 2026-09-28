import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { VerifiedRoleGate } from "@/features/auth/components/verified-role-gate";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { NotificationRealtimeProvider } from "@/features/notifications/components/notification-realtime-provider";
import { requireAuth } from "@/server/db/services/auth/access";
import { getUnreadNotificationCount } from "@/server/db/services/notifications/service";

export default async function UserLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAuth();
  const unreadCount = await getUnreadNotificationCount({
    recipientId: user.id,
  });

  return (
    <VerifiedRoleGate gateUnverifiedUsers={false} requiredRole="user">
      <NotificationRealtimeProvider initialUnreadCount={unreadCount}>
        <SidebarProvider className="h-svh max-h-svh min-h-0 overflow-hidden">
          <AppSidebar mode="user" />

          <SidebarInset className="h-svh min-h-0 min-w-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full min-h-0 w-full min-w-0 overflow-hidden">
              <div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col px-4 py-4 sm:px-6">
                <div className="mb-4 flex shrink-0 justify-end">
                  <NotificationBell />
                </div>
                {children}
              </div>
            </ScrollArea>
          </SidebarInset>
        </SidebarProvider>
      </NotificationRealtimeProvider>
    </VerifiedRoleGate>
  );
}
