import "server-only";

import {
  type NotificationRealtimeEvent,
  notificationRealtimeEventNames,
} from "@/shared/schemas/notifications";

export const MAX_PENDING_EVENTS = 100;

type Waiter = {
  resolve: (event: NotificationRealtimeEvent | null) => void;
};

export type NotificationSubscription = {
  cancelNext: () => void;
  close: () => void;
  getDebugState: () => {
    closed: boolean;
    pendingEvents: number;
    waiting: boolean;
  };
  next: () => Promise<NotificationRealtimeEvent | null>;
  recipientId: string;
};

// TODO: Replace this process-local broker with Redis pub/sub before running
// realtime notifications across multiple server instances.
const subscribers = new Map<string, Set<NotificationSubscriptionInternal>>();

class NotificationSubscriptionInternal implements NotificationSubscription {
  private closed = false;
  private pendingEvents: NotificationRealtimeEvent[] = [];
  private waiter: null | Waiter = null;

  constructor(readonly recipientId: string) {}

  enqueue(event: NotificationRealtimeEvent) {
    if (this.closed) return;

    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter.resolve(event);
      return;
    }

    if (this.pendingEvents.length >= MAX_PENDING_EVENTS) {
      this.pendingEvents = [
        {
          data: {},
          event: notificationRealtimeEventNames.resync,
        },
      ];
      return;
    }

    this.pendingEvents.push(event);
  }

  next() {
    if (this.closed) return Promise.resolve(null);

    const event = this.pendingEvents.shift();
    if (event) return Promise.resolve(event);

    if (this.waiter) {
      this.waiter.resolve(null);
      this.waiter = null;
    }

    return new Promise<NotificationRealtimeEvent | null>((resolve) => {
      this.waiter = { resolve };
    });
  }

  cancelNext() {
    if (!this.waiter) return;

    const waiter = this.waiter;
    this.waiter = null;
    waiter.resolve(null);
  }

  close() {
    if (this.closed) return;

    this.closed = true;
    const recipientSubscribers = subscribers.get(this.recipientId);
    recipientSubscribers?.delete(this);
    if (recipientSubscribers?.size === 0) {
      subscribers.delete(this.recipientId);
    }
    this.pendingEvents = [];
    this.cancelNext();
    this.waiter = null;
  }

  getDebugState() {
    return {
      closed: this.closed,
      pendingEvents: this.pendingEvents.length,
      waiting: Boolean(this.waiter),
    };
  }
}

export function subscribe(recipientId: string): NotificationSubscription {
  const subscription = new NotificationSubscriptionInternal(recipientId);
  const recipientSubscribers = subscribers.get(recipientId) ?? new Set();
  recipientSubscribers.add(subscription);
  subscribers.set(recipientId, recipientSubscribers);

  return subscription;
}

export function publish(recipientId: string, event: NotificationRealtimeEvent) {
  const recipientSubscribers = subscribers.get(recipientId);
  if (!recipientSubscribers) return;

  for (const subscription of recipientSubscribers) {
    subscription.enqueue(event);
  }
}

export function getSubscriberCount(recipientId: string) {
  return subscribers.get(recipientId)?.size ?? 0;
}

export function resetNotificationRealtimeBrokerForTests() {
  for (const recipientSubscribers of subscribers.values()) {
    for (const subscription of [...recipientSubscribers]) {
      subscription.close();
    }
  }
  subscribers.clear();
}
