import { headers } from "next/headers";

import { AdminContactSubmissionPlaceholderPage } from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Unread Contact Submissions", {
  path: "/admin/contact-submission/unread",
});

export default async function AdminContactSubmissionUnreadPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  return (
    <AdminContactSubmissionPlaceholderPage
      description="Unread contact submissions will be organized here."
      title="Unread Contact Submissions"
    />
  );
}
