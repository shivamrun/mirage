import { headers } from "next/headers";

import {
  JobsPageHeader,
  QueueAndWorkerTables,
} from "@/features/admin/components/jobs";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getAdminQueueSnapshot } from "@/server/jobs/admin";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Durable queues", {
  path: "/admin/jobs/queues",
});

export default async function AdminQueuesPage() {
  await requireAdmin({ headers: await headers() });
  const snapshot = await getAdminQueueSnapshot();

  return (
    <div className="space-y-5 pb-6">
      <JobsPageHeader snapshotAt={snapshot.snapshotAt} title="Durable queues" />
      <QueueAndWorkerTables snapshot={snapshot} />
    </div>
  );
}
