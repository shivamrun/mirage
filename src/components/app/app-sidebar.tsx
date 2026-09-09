"use client";

import {
  ArrowLeft,
  Home,
  LayoutDashboard,
  Settings2,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/client";
import { normalizeRoles, type RoleValue } from "@/lib/auth/roles";
import { siteConfig } from "@/lib/metadata";

import { NavMain } from "./nav-main";

const userData = {
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
    },
    {
      title: "Account",
      url: "/account",
      icon: UserRound,
      items: [
        {
          title: "Update profile",
          url: "/account/profile",
        },
        {
          title: "Security",
          url: "/account/security",
        },
      ],
    },
  ],
};

const adminShortcut = {
  title: "Admin",
  url: "/admin",
  icon: ShieldAlert,
};

const adminData = {
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
          title: "All Users",
          url: "/admin/users",
        },
        {
          title: "Banned Users",
          url: "/admin/users?filterField=banned&filterValue=true",
        },
        {
          title: "Unverified Users",
          url: "/admin/users?filterField=emailVerified&filterValue=false",
        },
        {
          title: "Recently Joined",
          url: "/admin/users/recently-joined",
        },
        {
          title: "Create User",
          url: "/admin/users/new",
        },
      ],
    },
    {
      title: "Security",
      url: "/admin/security",
      icon: ShieldAlert,
      items: [
        {
          title: "Controls",
          url: "/admin/security/controls",
        },
      ],
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings2,
    },
  ],
};

type SidebarMode = "user" | "admin";

function SidebarHeaderAction({ mode }: { mode: SidebarMode }) {
  const { state } = useSidebar();

  const collapsed = state === "collapsed";
  const isAdmin = mode === "admin";
  const href = isAdmin ? "/account" : siteConfig.links.home;
  const tooltip = isAdmin ? "Back to user mode" : siteConfig.name;

  if (collapsed) {
    return (
      <div className="flex h-10 items-center justify-center">
        {isAdmin ? (
          <SidebarMenuButton asChild tooltip={tooltip}>
            <Link href={href}>
              <ArrowLeft />
              <span>{tooltip}</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarTrigger className="size-8" />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center gap-2 pr-2">
      {isAdmin ? (
        <SidebarMenuButton asChild tooltip={tooltip} className="min-w-0 flex-1">
          <Link href={href}>
            <ArrowLeft />
            <span>{tooltip}</span>
          </Link>
        </SidebarMenuButton>
      ) : (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2">
          <div className="truncate font-medium">{siteConfig.name}</div>
        </Link>
      )}

      <SidebarTrigger className="size-8 shrink-0" />
    </div>
  );
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  mode?: SidebarMode;
  showRail?: boolean;
};

export function AppSidebar({
  mode = "user",
  showRail = true,
  ...props
}: AppSidebarProps) {
  const session = authClient.useSession();
  const userRole = (session.data?.user as { role?: RoleValue } | undefined)
    ?.role;
  const canAccessAdmin = normalizeRoles(userRole).includes("admin");
  const data =
    mode === "admin"
      ? adminData
      : {
          navMain: canAccessAdmin
            ? [...userData.navMain, adminShortcut]
            : userData.navMain,
        };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarHeaderAction mode={mode} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      {showRail ? <SidebarRail /> : null}
    </Sidebar>
  );
}
