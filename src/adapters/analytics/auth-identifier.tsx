"use client";

import * as React from "react";
import { analytics } from "@/adapters/analytics/client";
import { authClient } from "@/features/auth/better-auth/client";

const identifyRetryIntervalMs = 250;
const identifyRetryLimit = 20;

export function AnalyticsAuthIdentifier() {
  const session = authClient.useSession();
  const lastIdentifiedIdRef = React.useRef<null | string>(null);
  const userId = session.data?.user.id;

  React.useEffect(() => {
    if (!userId || lastIdentifiedIdRef.current === userId) {
      return;
    }

    const identifiedUserId = userId;
    let attemptCount = 0;
    let retryTimer: number | undefined;

    function identify() {
      attemptCount += 1;

      if (analytics.identify(identifiedUserId)) {
        lastIdentifiedIdRef.current = identifiedUserId;

        if (retryTimer) {
          window.clearInterval(retryTimer);
        }
        return;
      }

      if (attemptCount >= identifyRetryLimit && retryTimer) {
        window.clearInterval(retryTimer);
      }
    }

    identify();

    if (lastIdentifiedIdRef.current !== identifiedUserId) {
      retryTimer = window.setInterval(identify, identifyRetryIntervalMs);
    }

    return () => {
      if (retryTimer) {
        window.clearInterval(retryTimer);
      }
    };
  }, [userId]);

  return null;
}
