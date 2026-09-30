"use client";

import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Coins,
  CreditCard,
  Home,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  MailPlus,
  Settings2,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/features/auth/better-auth/client";
import { normalizeRoles, type RoleValue } from "@/features/auth/roles";
import { siteConfig } from "@/shared/metadata";

const userData = {
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
    },
    {
      title: "Billing",
      url: "/billing",
      icon: CreditCard,
    },
    {
      title: "Credit Lab",
      url: "/credits",
      icon: Coins,
    },
    {
      title: "Notifications",
      url: "/account/notifications",
      icon: Bell,
    },
    {
      title: "Account",
      url: "/account",
      icon: UserRound,
      items: [
        {
          title: "Profile",
          url: "/account/profile",
        },
        {
          title: "Security",
          url: "/account/security",
        },
        {
          title: "Referrals",
          url: "/account/referrals",
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
      title: "Invitations",
      url: "/admin/invitations",
      icon: MailPlus,
    },
    {
      title: "Contact Submission",
      url: "/admin/contact-submission",
      icon: Inbox,
      items: [
        {
          title: "All",
          url: "/admin/contact-submission/all",
        },
        {
          title: "Read",
          url: "/admin/contact-submission/all?filterField=status&filterValue=read",
        },
        {
          title: "Unread",
          url: "/admin/contact-submission/unread",
        },
        {
          title: "Archived",
          url: "/admin/contact-submission/all?filterField=status&filterValue=archived",
        },
      ],
    },
    {
      title: "Email Lists",
      url: "/admin/email-list",
      icon: Mail,
      items: [
        {
          title: "All Lists",
          url: "/admin/email-list/all",
        },
        {
          title: "Submissions",
          url: "/admin/email-list/submissions",
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

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: {
    title: string;
    url: string;
  }[];
};

function AppSidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length);

          const isActive =
            pathname === item.url ||
            item.items?.some((subItem) => pathname === subItem.url);

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>

                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isSubActive = pathname === subItem.url;

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubActive}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

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
        <AppSidebarNav items={data.navMain} />
      </SidebarContent>

      {showRail ? <SidebarRail /> : null}
    </Sidebar>
  );
}
