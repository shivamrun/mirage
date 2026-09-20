"use client";

import type React from "react";
import { TooltipProvider } from "../ui/tooltip";
import { AppThemeProvider } from "./app-theme-provider";

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </AppThemeProvider>
  );
};

export default AppProvider;
