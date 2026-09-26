import "server-only";

import { getServerAnalyticsConfig } from "@/adapters/analytics/config";
import type {
  AnalyticsTrack,
  ServerAuthoritativeEventMap,
  ServerBestEffortEventMap,
} from "@/adapters/analytics/events";
import { isValidDistinctId } from "@/adapters/analytics/events";
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
const eventsWithoutProperties = new Set<string>(["signup_completed"]);

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
}: {
  event: string;
  options?: ServerAnalyticsOptions;
  properties?: Record<string, unknown>;
}) {
  const config = getServerAnalyticsConfig();

  if (!config.enabled || !config.hostUrl || !config.websiteId) {
    return;
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
        `Analytics event delivery failed with status ${response.status}.`,
      );
    }
  } catch (error) {
    console.warn("Analytics event delivery failed:", error);
  } finally {
    clearTimeout(timeout);
  }
}

function trackServerBestEffort(
  event: keyof ServerBestEffortEventMap,
  propertiesOrOptions?: Record<string, unknown> | ServerAnalyticsOptions,
  maybeOptions?: ServerAnalyticsOptions,
) {
  const eventHasProperties = !eventsWithoutProperties.has(String(event));
  const properties = eventHasProperties
    ? (propertiesOrOptions as Record<string, unknown> | undefined)
    : undefined;
  const options = eventHasProperties
    ? maybeOptions
    : (propertiesOrOptions as ServerAnalyticsOptions | undefined);

  return sendServerEvent({ event, options, properties });
}

function trackServerAuthoritative(
  event: keyof ServerAuthoritativeEventMap,
  propertiesOrOptions?: Record<string, unknown> | ServerAnalyticsOptions,
  maybeOptions?: ServerAnalyticsOptions,
) {
  const properties = propertiesOrOptions as Record<string, unknown> | undefined;
  const options = {
    ...maybeOptions,
    timeoutMs: maybeOptions?.timeoutMs ?? defaultAuthoritativeTimeoutMs,
  };

  return sendServerEvent({ event, options, properties });
}

export const analytics = {
  track: trackServerBestEffort as AnalyticsTrack<
    ServerBestEffortEventMap,
    Promise<void>,
    ServerAnalyticsOptions
  >,
  trackAuthoritative: trackServerAuthoritative as AnalyticsTrack<
    ServerAuthoritativeEventMap,
    Promise<void>,
    ServerAnalyticsOptions
  >,
};
