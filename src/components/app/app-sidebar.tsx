"use client";

import { LayoutDashboard, Settings2, ShieldCheck, Users } from "lucide-react";
import type * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { siteConfig } from "@/lib/metadata";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const data = {
  user: {
    name: "Shivam",
    email: "shivam@example.com",
    avatar: "",
  },

  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
      items: [
        {
          title: "List Users",
          url: "/admin/users",
        },
        {
          title: "Create User",
          url: "/admin/users/new",
        },
      ],
    },
    {
      title: "Roles & Permissions",
      url: "/admin/roles",
      icon: ShieldCheck,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings2,
    },
  ],
};

function SidebarBrand() {
  const { state } = useSidebar();

  const collapsed = state === "collapsed";

  if (collapsed) {
    return (
      <div className="flex h-10 items-center justify-center">
        <SidebarTrigger className="size-8" />
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center gap-2 px-2">
      <a href="/admin" className="flex min-w-0 flex-1 items-center gap-2">
        <div className="truncate font-medium">{siteConfig.name}</div>
      </a>

      <SidebarTrigger className="size-8 shrink-0" />
    </div>
  );
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  showRail?: boolean;
};

export function AppSidebar({ showRail = true, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarBrand />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>

      {showRail ? <SidebarRail /> : null}
    </Sidebar>
  );
}
