"use client";

import type React from "react";
import { AnalyticsAttributionCapture } from "@/adapters/analytics/attribution-capture";
import { AnalyticsAuthIdentifier } from "@/adapters/analytics/auth-identifier";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";
import { AppThemeProvider } from "./app-theme-provider";

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppThemeProvider>
      <AnalyticsAttributionCapture />
      <AnalyticsAuthIdentifier />
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster closeButton />
    </AppThemeProvider>
  );
};

export default AppProvider;
