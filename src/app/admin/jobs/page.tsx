import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import {
  type AdminJobsPageSearchParams,
  adminJobsPageHref,
  JobsFilter,
  JobsOverview,
  JobsRefreshButton,
  JobsTable,
  parseAdminJobsSearchParams,
  QueueAndWorkerTables,
  SchedulesTable,
} from "@/features/admin/components/jobs";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getAdminJobsSnapshot, listAdminJobs } from "@/server/jobs/admin";
import { getPageMetadata } from "@/shared/metadata";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";

export const metadata = getPageMetadata("Jobs", { path: "/admin/jobs" });

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<AdminJobsPageSearchParams>;
}) {
  const filters = parseAdminJobsSearchParams(await searchParams);
  await requireAdmin({ headers: await headers() });

  const [snapshot, jobs] = await Promise.all([
    getAdminJobsSnapshot(),
    listAdminJobs({ ...filters, limit: DEFAULT_PAGE_SIZE }),
  ]);

  if (filters.page !== jobs.pagination.page) {
    redirect(adminJobsPageHref({ ...filters, page: jobs.pagination.page }));
  }

  return (
    <div className="space-y-7 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Durable queues, workers, retained jobs, and schedules.
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Snapshot {new Date(snapshot.snapshotAt).toLocaleString()}
          </p>
        </div>
        <JobsRefreshButton />
      </header>

      <JobsOverview snapshot={snapshot} />
      <QueueAndWorkerTables snapshot={snapshot} />

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold">Jobs</h2>
            <p className="text-muted-foreground text-sm">
              Completed and failed totals reflect retained BullMQ history.
            </p>
          </div>
          <JobsFilter
            name={filters.name}
            queue={filters.queue}
            status={filters.status}
          />
        </div>
        <JobsTable
          jobs={jobs.items}
          unavailableQueues={jobs.unavailableQueues}
        />
        <Pagination
          entityLabel="jobs"
          getPageHref={(page) => adminJobsPageHref({ ...filters, page })}
          pagination={jobs.pagination}
        />
      </section>

      <SchedulesTable snapshot={snapshot} />
    </div>
  );
}
