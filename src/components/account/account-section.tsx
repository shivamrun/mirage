import type * as React from "react";

function AccountSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid gap-4 py-6 first:pt-0 md:gap-8 max-w-3xl">
      <div className="min-w-0 space-y-1">
        <h2 className="font-medium text-base">{title}</h2>
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export { AccountSection };
