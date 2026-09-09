import { headers } from "next/headers";

import { AdminContactSubmissionPlaceholderPage } from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Read Contact Submissions", {
  path: "/admin/contact-submission/read",
});

export default async function AdminContactSubmissionReadPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  return (
    <AdminContactSubmissionPlaceholderPage
      description="Read contact submissions will be organized here."
      title="Read Contact Submissions"
    />
  );
}
