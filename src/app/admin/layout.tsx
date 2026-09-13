import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <VerifiedRoleGate gateTwoFactor requiredRole="admin">
      <SidebarProvider className="h-svh max-h-svh min-h-0 overflow-hidden">
        <AppSidebar mode="admin" />

        <SidebarInset className="h-svh min-h-0 min-w-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full min-h-0 w-full min-w-0 overflow-hidden">
            <div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col px-4 py-4 sm:px-6">
              {children}
            </div>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </VerifiedRoleGate>
  );
}
