import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import {
  AdminContactSubmissionTable,
  AdminContactSubmissionToolbar,
} from "@/features/admin/components";
import {
  type AdminContactSubmissionPageSearchParams,
  adminContactSubmissionHrefFromSearchParams,
  adminContactSubmissionRawHrefFromSearchParams,
  contactSubmissionsPageHref,
  parseAdminContactSubmissionSearchParams,
} from "@/features/admin/query/contact-submission-query";
import { listAdminContactSubmissionsView } from "@/server/db/services/admin/contact-submission";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

import {
  bulkUpdateContactSubmissionStatusAction,
  updateContactSubmissionStatusAction,
} from "./actions";

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
  const { page, ...state } = parseAdminContactSubmissionSearchParams(params);
  const canonicalHref = adminContactSubmissionHrefFromSearchParams(params);
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  if (adminContactSubmissionRawHrefFromSearchParams(params) !== canonicalHref) {
    redirect(canonicalHref);
  }

  const clearSearchHref = contactSubmissionsPageHref({
    filterField: state.filterField,
    filterValue: state.filterValue,
  });
  const submissions = await listAdminContactSubmissionsView({
    page,
    state,
  });

  if (page !== submissions.page) {
    redirect(
      contactSubmissionsPageHref({
        page: submissions.page,
        ...state,
      }),
    );
  }

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
        bulkAction={bulkUpdateContactSubmissionStatusAction}
        clearSearchHref={clearSearchHref}
        hasSubmissions={submissions.submissions.length > 0}
        state={state}
      />

      <AdminContactSubmissionTable
        clearSearchHref={clearSearchHref}
        hasSearch={Boolean(state.query)}
        query={state.query}
        rowAction={updateContactSubmissionStatusAction}
        submissions={submissions.submissions}
      />

      <Pagination
        entityLabel="submissions"
        getPageHref={(page) =>
          contactSubmissionsPageHref({
            page,
            ...state,
          })
        }
        pagination={submissions}
      />
    </div>
  );
}
