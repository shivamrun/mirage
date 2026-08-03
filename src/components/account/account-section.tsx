import type * as React from "react";

function AccountSection({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-base">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export { AccountSection };
