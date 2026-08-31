"use client";

import type * as React from "react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

function AppShell({ children }: AppShellProps) {
  const sidebar = <AppSidebar side="left" />;
  const content = (
    <SidebarInset className="max-w-6xl mx-auto">
      <SidebarTrigger className="mb-2 text-muted-foreground hover:text-foreground md:hidden" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
        {children}
      </div>
    </SidebarInset>
  );

  return (
    <SidebarProvider>
      {sidebar}
      {content}
    </SidebarProvider>
  );
}

export { AppShell };
