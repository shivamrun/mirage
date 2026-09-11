import { ArrowRight } from "lucide-react";
import Link from "next/link";

type ContentCardProps = {
  description?: string;
  href: string;
  meta?: string;
  title: string;
};

export function ContentCard({
  description,
  href,
  meta,
  title,
}: ContentCardProps) {
  return (
    <Link
      className="group grid gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/60"
      href={href}
    >
      {meta ? (
        <p className="font-medium text-muted-foreground text-xs uppercase">
          {meta}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold text-lg leading-7">{title}</h2>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {description ? (
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      ) : null}
    </Link>
  );
}
