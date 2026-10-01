import { headers } from "next/headers";

import {
  JobsPageHeader,
  SchedulesTable,
} from "@/features/admin/components/jobs";
import { requireAdmin } from "@/server/db/services/auth/access";
import { listAdminSchedules } from "@/server/jobs/admin";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Scheduling", {
  path: "/admin/jobs/schedules",
});

export default async function AdminSchedulesPage() {
  await requireAdmin({ headers: await headers() });
  const schedules = await listAdminSchedules().catch(() => null);
  const snapshotAt = new Date().toISOString();

  return (
    <div className="space-y-5 pb-6">
      <JobsPageHeader snapshotAt={snapshotAt} title="Scheduling" />
      <SchedulesTable schedules={schedules} />
    </div>
  );
}
