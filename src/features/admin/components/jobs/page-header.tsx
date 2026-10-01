import { JobsRefreshButton } from "./refresh-button";

export function JobsPageHeader({
  snapshotAt,
  title,
}: {
  snapshotAt: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground text-xs">
          Updated {new Date(snapshotAt).toLocaleString()}
        </p>
      </div>
      <JobsRefreshButton />
    </header>
  );
}
