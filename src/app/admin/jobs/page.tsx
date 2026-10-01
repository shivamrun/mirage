import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import {
  type AdminJobsPageSearchParams,
  adminJobsPageHref,
  JobsFilter,
  JobsOverview,
  JobsPageHeader,
  JobsTable,
  parseAdminJobsSearchParams,
} from "@/features/admin/components/jobs";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getAdminQueueSnapshot, listAdminJobs } from "@/server/jobs/admin";
import { getPageMetadata } from "@/shared/metadata";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";

export const metadata = getPageMetadata("Background jobs", {
  path: "/admin/jobs",
});

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<AdminJobsPageSearchParams>;
}) {
  const filters = parseAdminJobsSearchParams(await searchParams);
  await requireAdmin({ headers: await headers() });

  const [snapshot, jobs] = await Promise.all([
    getAdminQueueSnapshot(),
    listAdminJobs({ ...filters, limit: DEFAULT_PAGE_SIZE }),
  ]);

  if (filters.page !== jobs.pagination.page) {
    redirect(adminJobsPageHref({ ...filters, page: jobs.pagination.page }));
  }

  return (
    <div className="space-y-5 pb-6">
      <JobsPageHeader
        snapshotAt={snapshot.snapshotAt}
        title="Background jobs"
      />

      <JobsOverview snapshot={snapshot} />

      <section className="space-y-3">
        <JobsFilter
          name={filters.name}
          queue={filters.queue}
          status={filters.status}
        />
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
    </div>
  );
}
