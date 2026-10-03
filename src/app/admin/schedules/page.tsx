import { headers } from "next/headers";

import {
  SchedulesPageHeader,
  SchedulesTable,
} from "@/features/admin/components/schedules";
import { requireAdmin } from "@/server/db/services/auth/access";
import { listAdminSchedules } from "@/server/jobs/admin-schedules";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Schedules", {
  path: "/admin/schedules",
});

export default async function AdminSchedulesPage() {
  await requireAdmin({ headers: await headers() });
  const schedules = await listAdminSchedules().catch(() => null);
  const snapshotAt = new Date().toISOString();

  return (
    <div className="space-y-5 pb-6">
      <SchedulesPageHeader snapshotAt={snapshotAt} />
      <SchedulesTable schedules={schedules} />
    </div>
  );
}
