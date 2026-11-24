"use client";

import { isValidDistinctId } from "@/adapters/analytics/events";

declare global {
  interface Window {
    umami?: {
      identify?: (id: string) => void;
    };
  }
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
};
