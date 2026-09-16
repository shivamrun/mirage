import { redirect } from "next/navigation";

import {
  type AdminContactSubmissionPageSearchParams,
  adminContactSubmissionStatusHrefFromSearchParams,
} from "@/features/admin/query/contact-submission-query";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Archived Contact Submissions", {
  path: "/admin/contact-submission/archived",
});

type AdminContactSubmissionArchivedPageProps = {
  searchParams: Promise<AdminContactSubmissionPageSearchParams>;
};

export default async function AdminContactSubmissionArchivedPage({
  searchParams,
}: AdminContactSubmissionArchivedPageProps) {
  const params = await searchParams;

  redirect(
    adminContactSubmissionStatusHrefFromSearchParams(params, "archived"),
  );
}
