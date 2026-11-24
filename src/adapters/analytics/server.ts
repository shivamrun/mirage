import "server-only";

import { getServerAnalyticsConfig } from "@/adapters/analytics/config";
import type {
  AnalyticsTrack,
  ServerBestEffortEventMap,
} from "@/adapters/analytics/events";
import {
  type BillingAnalyticsEvent,
  type EventsWithoutProperties,
  isValidDistinctId,
} from "@/adapters/analytics/events";
import { env } from "@/shared/env";

type ServerAnalyticsContext = {
  distinctId?: string;
  url?: string;
};

type ServerAnalyticsOptions = {
  context?: ServerAnalyticsContext;
  timeoutMs?: number;
};

const defaultBestEffortTimeoutMs = 1_500;
const defaultAuthoritativeTimeoutMs = 2_500;
const serverUserAgent = "Mirage/0.1 Analytics Server";
const eventsWithoutProperties = {
  login_completed: true,
} satisfies Record<EventsWithoutProperties<ServerBestEffortEventMap>, true>;

function pathnameOnly(value: string | undefined) {
  if (!value) {
    return "/";
  }

  try {
    const url = new URL(value, env.NEXT_PUBLIC_BASE_URL);
    return url.pathname || "/";
  } catch {
    return value.startsWith("/") && !value.includes("?") ? value : "/";
  }
}

async function sendServerEvent({
  event,
  options,
  properties,
  timestamp,
}: {
  event: string;
  options?: ServerAnalyticsOptions;
  properties?: Record<string, unknown>;
  timestamp?: number;
}) {
  const config = getServerAnalyticsConfig();

  if (!config.enabled || !config.hostUrl || !config.websiteId) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? defaultBestEffortTimeoutMs,
  );

  try {
    const payload: Record<string, unknown> = {
      hostname: new URL(env.NEXT_PUBLIC_BASE_URL).hostname,
      name: event,
      url: pathnameOnly(options?.context?.url),
      website: config.websiteId,
    };

    if (properties) {
      payload.data = properties;
    }
    if (timestamp !== undefined) payload.timestamp = timestamp;

    if (isValidDistinctId(options?.context?.distinctId)) {
      payload.id = options.context.distinctId;
    }

    const response = await fetch(new URL("/api/send", config.hostUrl), {
      body: JSON.stringify({
        payload,
        type: "event",
      }),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": serverUserAgent,
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `Analytics event ${event} failed with status ${response.status}.`,
      );
    }
    return response.ok;
  } catch (error) {
    console.warn(`Analytics event ${event} delivery failed:`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function trackServerBestEffort(
  event: keyof ServerBestEffortEventMap,
  propertiesOrOptions?: Record<string, unknown> | ServerAnalyticsOptions,
  maybeOptions?: ServerAnalyticsOptions,
) {
  const eventHasProperties = !Object.hasOwn(eventsWithoutProperties, event);
  const properties = eventHasProperties
    ? (propertiesOrOptions as Record<string, unknown> | undefined)
    : undefined;
  const options = eventHasProperties
    ? maybeOptions
    : (propertiesOrOptions as ServerAnalyticsOptions | undefined);

  return sendServerEvent({ event, options, properties }).then(() => undefined);
}

export function deliverBillingAnalytics(
  { event, properties, context }: BillingAnalyticsEvent,
  occurredAt: Date,
) {
  return sendServerEvent({
    event,
    options: { context, timeoutMs: defaultAuthoritativeTimeoutMs },
    properties,
    timestamp: Math.floor(occurredAt.getTime() / 1000),
  });
}

export const analytics = {
  track: trackServerBestEffort as AnalyticsTrack<
    ServerBestEffortEventMap,
    Promise<void>,
    ServerAnalyticsOptions
  >,
};
