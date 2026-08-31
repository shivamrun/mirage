import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <VerifiedRoleGate requiredRole="admin">
      <SidebarProvider className="h-svh max-h-svh min-h-0 overflow-hidden">
        <AppSidebar />

        <SidebarInset className="h-svh max-h-svh min-h-0 min-w-0 flex-1 overflow-hidden max-w-6xl mx-auto">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </VerifiedRoleGate>
  );
}
