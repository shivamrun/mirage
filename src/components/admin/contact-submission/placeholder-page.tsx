import { EmptyState } from "@/components/admin/user-detail/primitives";

type AdminContactSubmissionPlaceholderPageProps = {
  description: string;
  title: string;
};

export function AdminContactSubmissionPlaceholderPage({
  description,
  title,
}: AdminContactSubmissionPlaceholderPageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      <section className="min-h-0 flex-1">
        <EmptyState
          description="This view is intentionally blank for now."
          title="Coming soon"
        />
      </section>
    </div>
  );
}
