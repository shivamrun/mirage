"use client";

import {
  BookOpen,
  FileText,
  History,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from "lucide-react";
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
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Documents",
      url: "/documents",
      icon: FileText,
      items: [
        {
          title: "All Documents",
          url: "/documents",
        },
        {
          title: "Recent",
          url: "/documents/recent",
        },
      ],
    },
    {
      title: "Conversions",
      url: "/conversions",
      icon: Sparkles,
      items: [
        {
          title: "Markdown to PDF",
          url: "/convert/pdf",
        },
        {
          title: "Markdown to DOCX",
          url: "/convert/docx",
        },
        {
          title: "Markdown to Markdown",
          url: "/convert/markdown",
        },
      ],
    },
    {
      title: "History",
      url: "/history",
      icon: History,
    },
    {
      title: "Documentation",
      url: "/docs",
      icon: BookOpen,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/settings",
        },
        {
          title: "API Keys",
          url: "/settings/api-keys",
        },
        {
          title: "Usage",
          url: "/settings/usage",
        },
        {
          title: "Billing",
          url: "/settings/billing",
        },
      ],
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
      <a href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-medium">{siteConfig.name}</div>
        </div>
      </a>

      <SidebarTrigger className="size-8 shrink-0" />
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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

      <SidebarRail />
    </Sidebar>
  );
}
