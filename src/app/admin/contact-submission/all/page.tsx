import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  type AdminContactSubmissionPageSearchParams,
  AdminContactSubmissionTable,
  AdminContactSubmissionToolbar,
  adminContactSubmissionHrefFromSearchParams,
  adminContactSubmissionRawHrefFromSearchParams,
  contactSubmissionsPageHref,
  parseAdminContactSubmissionSearchParams,
} from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import { listContactSubmissions } from "@/server/db/dal/contact-submission";

export const metadata = getPageMetadata("Contact Submissions", {
  path: "/admin/contact-submission/all",
});

type AdminContactSubmissionAllPageProps = {
  searchParams: Promise<AdminContactSubmissionPageSearchParams>;
};

export default async function AdminContactSubmissionAllPage({
  searchParams,
}: AdminContactSubmissionAllPageProps) {
  const params = await searchParams;
  const state = parseAdminContactSubmissionSearchParams(params);
  const canonicalHref = adminContactSubmissionHrefFromSearchParams(params);
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  if (adminContactSubmissionRawHrefFromSearchParams(params) !== canonicalHref) {
    redirect(canonicalHref);
  }

  const submissions = await listContactSubmissions({
    state,
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Contact Submissions
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Review messages submitted through the contact form.
        </p>
      </header>

      <AdminContactSubmissionToolbar
        clearSearchHref={contactSubmissionsPageHref()}
        state={state}
      />

      <AdminContactSubmissionTable
        hasSearch={Boolean(state.query)}
        query={state.query}
        submissions={submissions}
      />
    </div>
  );
}
