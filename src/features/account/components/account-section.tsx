import type * as React from "react";

import { HeadingBlock } from "@/components/heading-block";

function AccountSectionStack({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-y-8">{children}</div>;
}

function AccountSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="border-border border-b bg-muted/45 px-6 py-4">
        <HeadingBlock
          description={description}
          size="md"
          title={title}
          titleAs="h2"
        />
      </div>
      <div className="bg-card px-6 py-5">{children}</div>
    </section>
  );
}

export { AccountSection, AccountSectionStack };
