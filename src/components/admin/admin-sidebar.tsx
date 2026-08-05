"use client";

import { ChevronLeft, MailPlus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNavItems = [
  {
    href: "/admin/users",
    icon: Users,
    label: "Users",
  },
  {
    href: "/admin/creator-invites",
    icon: MailPlus,
    label: "Creator invites",
  },
  {
    href: "/admin/moderator-invites",
    icon: ShieldCheck,
    label: "Moderator invites",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-h-screen w-72 shrink-0 border-r px-5 py-8">
      <Button
        asChild
        className="h-fit gap-x-1 px-2 py-2 text-sm"
        variant="ghost"
      >
        <Link href="/">
          <ChevronLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </Button>

      <nav aria-label="Admin" className="mt-6">
        <ul className="space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                    }),
                    "w-full justify-start gap-x-3 text-sm font-normal",
                  )}
                  href={item.href}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export { AdminSidebar };
