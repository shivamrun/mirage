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
  const sidebar = <AppSidebar mode="user" side="left" />;
  const content = (
    <SidebarInset className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
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
