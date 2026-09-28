import "server-only";

import { createClient, type RedisClientType } from "redis";

import {
  isRedisConfigured,
  RedisUnavailableError,
  runRedisCommand,
} from "@/adapters/redis/client";
import { redisNotificationChannel } from "@/adapters/redis/keys";
import { env } from "@/shared/env";
import {
  type NotificationRealtimeEvent,
  notificationRealtimeEventNames,
  notificationRealtimeEventSchema,
} from "@/shared/schemas/notifications";

export const MAX_PENDING_EVENTS = 100;
const REDIS_SUBSCRIBER_CONNECT_TIMEOUT_MS = 750;

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

const subscribers = new Map<string, Set<NotificationSubscriptionInternal>>();
const recipientChannels = new Map<string, string>();
const redisSubscriptions = new Map<
  string,
  {
    promise: Promise<void>;
    recipientId: string;
    subscribed: boolean;
  }
>();
const recipientsNeedingRecoveryResync = new Set<string>();

let redisSubscriberClient: RedisClientType | null = null;
let redisSubscriberConnectPromise: Promise<RedisClientType> | null = null;
let redisSubscriberOutageActive = false;
let redisSubscriberRetryTimer: ReturnType<typeof setTimeout> | null = null;
let redisSubscriberClosingForTests = false;

function resyncEvent(): NotificationRealtimeEvent {
  return {
    data: {},
    event: notificationRealtimeEventNames.resync,
  };
}

function fanOutLocal(recipientId: string, event: NotificationRealtimeEvent) {
  const recipientSubscribers = subscribers.get(recipientId);
  if (!recipientSubscribers) return;

  for (const subscription of recipientSubscribers) {
    subscription.enqueue(event);
  }
}

function markRedisRecovered() {
  redisSubscriberOutageActive = false;
  recipientsNeedingRecoveryResync.clear();
}

function scheduleRedisResubscribe() {
  if (!isRedisConfigured() || redisSubscriberRetryTimer) return;
  if (subscribers.size === 0) return;

  redisSubscriberRetryTimer = setTimeout(() => {
    redisSubscriberRetryTimer = null;
    for (const recipientId of subscribers.keys()) {
      ensureRedisSubscribed(recipientId);
    }

    if (redisSubscriberOutageActive && subscribers.size > 0) {
      scheduleRedisResubscribe();
    }
  }, REDIS_SUBSCRIBER_CONNECT_TIMEOUT_MS);
}

function markRedisOutageForLocalSubscribers() {
  if (redisSubscriberClosingForTests) return;

  const failedClient = redisSubscriberClient;
  redisSubscriberClient = null;
  redisSubscriberConnectPromise = null;
  redisSubscriptions.clear();
  if (failedClient?.isOpen) {
    void failedClient.close().catch(() => {
      // The replacement subscriber will be created by the retry path.
    });
  }

  if (redisSubscriberOutageActive) {
    scheduleRedisResubscribe();
    return;
  }

  redisSubscriberOutageActive = true;
  for (const recipientId of subscribers.keys()) {
    recipientsNeedingRecoveryResync.add(recipientId);
    fanOutLocal(recipientId, resyncEvent());
  }
  scheduleRedisResubscribe();
}

function createRedisSubscriberClient() {
  const client = createClient({
    socket: {
      connectTimeout: REDIS_SUBSCRIBER_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
    url: env.REDIS_URL,
  });

  client.on("error", () => {
    markRedisOutageForLocalSubscribers();
  });
  client.on("end", () => {
    markRedisOutageForLocalSubscribers();
  });

  return client;
}

async function getRedisSubscriberClient() {
  if (!isRedisConfigured()) {
    throw new RedisUnavailableError("Redis is not configured.");
  }

  if (!redisSubscriberClient) {
    redisSubscriberClient = createRedisSubscriberClient();
  }

  const client = redisSubscriberClient;
  if (client.isOpen) {
    return client;
  }

  redisSubscriberConnectPromise ??= client
    .connect()
    .then(() => {
      markRedisRecovered();
      return client;
    })
    .catch((error) => {
      redisSubscriberClient = null;
      markRedisOutageForLocalSubscribers();
      throw new RedisUnavailableError(
        "Redis notification subscriber connection failed.",
        { cause: error },
      );
    })
    .finally(() => {
      redisSubscriberConnectPromise = null;
    });

  return redisSubscriberConnectPromise;
}

function handleRedisMessage(recipientId: string, message: string) {
  try {
    const parsed = notificationRealtimeEventSchema.safeParse(
      JSON.parse(message),
    );

    if (!parsed.success) {
      fanOutLocal(recipientId, resyncEvent());
      return;
    }

    markRedisRecovered();
    fanOutLocal(recipientId, parsed.data);
  } catch {
    fanOutLocal(recipientId, resyncEvent());
  }
}

function channelForRecipient(recipientId: string) {
  const existing = recipientChannels.get(recipientId);
  if (existing) return existing;

  const channel = redisNotificationChannel(recipientId);
  recipientChannels.set(recipientId, channel);
  return channel;
}

function publishChannelForRecipient(recipientId: string) {
  return redisNotificationChannel(recipientId);
}

function ensureRedisSubscribed(recipientId: string) {
  if (!isRedisConfigured()) return;

  const channel = channelForRecipient(recipientId);
  const existing = redisSubscriptions.get(channel);
  if (existing) return;

  const promise = getRedisSubscriberClient()
    .then(async (client) => {
      await client.subscribe(channel, (message) => {
        handleRedisMessage(recipientId, message);
      });
      redisSubscriptions.set(channel, {
        promise,
        recipientId,
        subscribed: true,
      });
      markRedisRecovered();

      if (recipientsNeedingRecoveryResync.has(recipientId)) {
        recipientsNeedingRecoveryResync.delete(recipientId);
        fanOutLocal(recipientId, resyncEvent());
      }
    })
    .catch(() => {
      if (redisSubscriptions.get(channel)?.promise === promise) {
        redisSubscriptions.delete(channel);
      }
    });

  redisSubscriptions.set(channel, {
    promise,
    recipientId,
    subscribed: false,
  });
}

function unsubscribeRedisIfUnused(recipientId: string) {
  const recipientSubscribers = subscribers.get(recipientId);
  if (recipientSubscribers && recipientSubscribers.size > 0) return;

  const channel = recipientChannels.get(recipientId);
  if (!channel) return;

  recipientChannels.delete(recipientId);
  const state = redisSubscriptions.get(channel);
  redisSubscriptions.delete(channel);

  if (!state || !isRedisConfigured()) return;

  void state.promise
    .then(async () => {
      if (!redisSubscriberClient?.isOpen) return;
      await redisSubscriberClient.unsubscribe(channel);
    })
    .catch(() => {
      // Best-effort cleanup only.
    });
}

function publishViaRedis(
  recipientId: string,
  event: NotificationRealtimeEvent,
) {
  const parsed = notificationRealtimeEventSchema.parse(event);
  const payload = JSON.stringify(parsed);
  const channel = publishChannelForRecipient(recipientId);

  return runRedisCommand((client) => client.publish(channel, payload));
}

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
      unsubscribeRedisIfUnused(this.recipientId);
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

  if (recipientSubscribers.size === 1) {
    ensureRedisSubscribed(recipientId);
  }

  return subscription;
}

export function publish(recipientId: string, event: NotificationRealtimeEvent) {
  if (!isRedisConfigured()) {
    fanOutLocal(recipientId, event);
    return;
  }

  if (getSubscriberCount(recipientId) > 0) {
    ensureRedisSubscribed(recipientId);
  }

  void publishViaRedis(recipientId, event).catch(() => {
    fanOutLocal(recipientId, event);
  });
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
  recipientChannels.clear();
  redisSubscriptions.clear();
  recipientsNeedingRecoveryResync.clear();
  redisSubscriberOutageActive = false;
  redisSubscriberConnectPromise = null;
  if (redisSubscriberRetryTimer) {
    clearTimeout(redisSubscriberRetryTimer);
    redisSubscriberRetryTimer = null;
  }

  const client = redisSubscriberClient;
  redisSubscriberClient = null;
  if (client?.isOpen) {
    redisSubscriberClosingForTests = true;
    void client
      .close()
      .catch(() => {
        // Test cleanup should not fail because Redis is already gone.
      })
      .finally(() => {
        redisSubscriberClosingForTests = false;
      });
  }
}
