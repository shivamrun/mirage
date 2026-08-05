import type * as React from "react";

import { cn } from "@/lib/utils";

type AuthFormShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function AuthFormShell({
  title,
  description,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <section className="w-full max-w-md">
      <div className="mb-6 space-y-2 pt-4 pb-2">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl">{title}</h1>
          <p className="text-muted-foreground text-base mt-3">{description}</p>
        </div>
      </div>
      {children}
      {footer ? (
        <div className="mt-6 text-center text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function AuthStatusMessage({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "error";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "info" && "bg-muted/50 text-muted-foreground",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "error" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export { AuthFormShell, AuthStatusMessage };
