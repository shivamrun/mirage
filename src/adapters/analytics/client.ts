"use client";

import type {
  AnalyticsTrack,
  ClientAnalyticsEventMap,
} from "@/adapters/analytics/events";
import { isValidDistinctId } from "@/adapters/analytics/events";

declare global {
  interface Window {
    umami?: {
      identify?: (id: string) => void;
      track?: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

function trackClientEvent(
  event: keyof ClientAnalyticsEventMap,
  properties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.umami?.track?.(event, properties);
}

export const analytics = {
  identify(userId: string) {
    if (!isValidDistinctId(userId) || typeof window === "undefined") {
      return false;
    }

    if (!window.umami?.identify) {
      return false;
    }

    window.umami.identify(userId);
    return true;
  },
  track: trackClientEvent as AnalyticsTrack<ClientAnalyticsEventMap, void>,
};
