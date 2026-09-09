import { redirect } from "next/navigation";

import {
  type AdminContactSubmissionPageSearchParams,
  adminContactSubmissionStatusHrefFromSearchParams,
} from "@/components/admin";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Read Contact Submissions", {
  path: "/admin/contact-submission/read",
});

type AdminContactSubmissionReadPageProps = {
  searchParams: Promise<AdminContactSubmissionPageSearchParams>;
};

export default async function AdminContactSubmissionReadPage({
  searchParams,
}: AdminContactSubmissionReadPageProps) {
  const params = await searchParams;

  redirect(adminContactSubmissionStatusHrefFromSearchParams(params, "read"));
}
