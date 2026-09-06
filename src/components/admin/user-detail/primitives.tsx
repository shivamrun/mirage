import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StatusBadge({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "danger" | "good" | "neutral" | "warning";
}) {
  return (
    <Badge
      className={cn(
        "p-1 min-w-0 rounded-md font-medium text-xs",
        tone === "good" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" &&
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "danger" &&
          "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-border bg-muted/50 text-muted-foreground",
      )}
      variant="outline"
    >
      {Icon ? <Icon className="size-3 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </Badge>
  );
}

export function DialogButton({
  children,
  className,
  icon: Icon,
  target,
  size = "sm",
  variant = "outline",
}: {
  children: ReactNode;
  className?: string;
  icon: LucideIcon;
  target: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button
      aria-haspopup="dialog"
      className={cn("min-w-0 gap-2", className)}
      data-dialog-target={target}
      size={size}
      type="button"
      variant={variant}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </Button>
  );
}

export function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <div className="border-b bg-muted/30 px-4 py-2 font-medium text-muted-foreground text-xs">
        {title}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

export function DetailPanel({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex min-w-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-base">{title}</h2>
          <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
        </div>

        {actions ? (
          <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

export function DetailRow({
  action,
  children,
  label,
  mono = false,
}: {
  action?: ReactNode;
  children: ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div
        className={cn(
          "min-w-0 break-words text-sm",
          mono && "break-all font-mono text-xs",
        )}
      >
        {children}
      </div>
      {action ? (
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-h-44 min-w-0 items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center">
      <div className="max-w-sm">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

export function RecordGrid({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <dl
      className={cn(
        "grid min-w-0 grid-cols-1 gap-x-5 gap-y-3",
        compact
          ? "sm:grid-cols-[repeat(2,minmax(0,1fr))]"
          : "md:grid-cols-[repeat(2,minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function RecordField({
  children,
  label,
  mono = false,
}: {
  children: ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "mt-1 min-w-0 break-words text-sm",
          mono && "break-all font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
