"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/shared/api/client";
import { notificationRealtimeEventNames } from "@/shared/schemas/notifications";

type NotificationRealtimeContextValue = {
  unreadCount: number;
};

const NotificationRealtimeContext =
  createContext<NotificationRealtimeContextValue | null>(null);

export function NotificationRealtimeProvider({
  children,
  initialUnreadCount,
}: {
  children: ReactNode;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);

  pathnameRef.current = pathname;
  routerRef.current = router;

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function refreshNotificationsPage() {
      if (pathnameRef.current !== "/account/notifications") return;
      if (refreshTimeoutRef.current) return;

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        routerRef.current.refresh();
      }, 150);
    }

    async function resyncUnreadCount() {
      const { data, error } =
        await api.api.account.notifications["unread-count"].get({
          fetch: { cache: "no-store" },
        });
      if (error || !data) return;
      setUnreadCount(data.unreadCount);
    }

    const eventSource = new EventSource("/api/account/notifications/events");

    eventSource.addEventListener(
      notificationRealtimeEventNames.connected,
      (event) => {
        const data = JSON.parse(event.data) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
      },
    );

    eventSource.addEventListener(
      notificationRealtimeEventNames.created,
      (event) => {
        const data = JSON.parse(event.data) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
        refreshNotificationsPage();
      },
    );

    eventSource.addEventListener(
      notificationRealtimeEventNames.unreadCountChanged,
      (event) => {
        const data = JSON.parse(event.data) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
        refreshNotificationsPage();
      },
    );

    eventSource.addEventListener(notificationRealtimeEventNames.resync, () => {
      void resyncUnreadCount();
      refreshNotificationsPage();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const value = useMemo(() => ({ unreadCount }), [unreadCount]);

  return (
    <NotificationRealtimeContext.Provider value={value}>
      {children}
    </NotificationRealtimeContext.Provider>
  );
}

export function useNotificationRealtime() {
  const context = useContext(NotificationRealtimeContext);
  if (!context) {
    throw new Error(
      "useNotificationRealtime must be used within NotificationRealtimeProvider.",
    );
  }

  return context;
}
