import type { CSSProperties } from "react";

import { normalizeRoles } from "@/lib/auth/access";

type UserRole = Parameters<typeof normalizeRoles>[0];

export function formatJoinedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return initials || "U";
}

const roleBadgeClassNames: Record<string, string> = {
  admin: "border-primary/30 bg-primary/15 text-primary-foreground",
  user: "border-border bg-muted text-muted-foreground",
};

export function RoleBadges({ role }: { role: UserRole }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {normalizeRoles(role).map((roleName) => (
        <span
          className={`inline-flex h-6 items-center rounded-md border px-2 font-medium text-xs ${
            roleBadgeClassNames[roleName] ?? roleBadgeClassNames.user
          }`}
          key={roleName}
        >
          {roleName}
        </span>
      ))}
    </div>
  );
}

export function UserAvatar({
  image,
  name,
}: {
  image?: null | string;
  name: string;
}) {
  const style = image
    ? ({
        backgroundImage: `url("${image}")`,
      } satisfies CSSProperties)
    : undefined;

  return (
    <div
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted bg-cover bg-center font-semibold text-muted-foreground text-sm"
      style={style}
    >
      {!image ? getInitials(name) : null}
    </div>
  );
}
