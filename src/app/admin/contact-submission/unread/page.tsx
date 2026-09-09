import { redirect } from "next/navigation";

import {
  type AdminContactSubmissionPageSearchParams,
  adminContactSubmissionStatusHrefFromSearchParams,
} from "@/components/admin";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Unread Contact Submissions", {
  path: "/admin/contact-submission/unread",
});

type AdminContactSubmissionUnreadPageProps = {
  searchParams: Promise<AdminContactSubmissionPageSearchParams>;
};

export default async function AdminContactSubmissionUnreadPage({
  searchParams,
}: AdminContactSubmissionUnreadPageProps) {
  const params = await searchParams;

  redirect(adminContactSubmissionStatusHrefFromSearchParams(params, "new"));
}
