"use client";

import * as React from "react";
import { captureAnalyticsAttribution } from "@/adapters/analytics/attribution";

export function AnalyticsAttributionCapture() {
  React.useEffect(() => {
    captureAnalyticsAttribution();
  }, []);

  return null;
}
