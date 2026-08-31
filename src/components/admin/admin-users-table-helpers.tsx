import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { normalizeRoles } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type UserRole = Parameters<typeof normalizeRoles>[0];

const joinedDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const roleStyles: Record<string, string> = {
  admin: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10",
  user: "border-border bg-muted/60 text-muted-foreground hover:bg-muted/60",
};

export function formatJoinedDate(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "—";
  }

  return joinedDateFormatter.format(value);
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatRoleName(role: string) {
  return role
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function RoleBadges({ role }: { role: UserRole }) {
  const roles = normalizeRoles(role);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.map((roleName) => (
        <Badge
          key={roleName}
          variant="outline"
          className={cn(
            "h-6 rounded-md px-2 font-medium text-xs",
            roleStyles[roleName] ?? roleStyles.user,
          )}
        >
          {formatRoleName(roleName)}
        </Badge>
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
  return (
    <Avatar>
      {image ? (
        <AvatarImage src={image} alt={name} className="object-cover" />
      ) : null}

      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
