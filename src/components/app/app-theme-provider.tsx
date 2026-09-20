"use client";

import { ThemeProvider } from "next-themes";
import type * as React from "react";

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey="mirage-theme"
    >
      {children}
    </ThemeProvider>
  );
}

export { AppThemeProvider };
