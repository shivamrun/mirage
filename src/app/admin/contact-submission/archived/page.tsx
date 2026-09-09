import { headers } from "next/headers";

import { AdminContactSubmissionPlaceholderPage } from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Archived Contact Submissions", {
  path: "/admin/contact-submission/archived",
});

export default async function AdminContactSubmissionArchivedPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  return (
    <AdminContactSubmissionPlaceholderPage
      description="Archived contact submissions will be organized here."
      title="Archived Contact Submissions"
    />
  );
}
