import {
  ADMIN_CONTACT_SUBMISSION_PAGE_SIZE,
  type AdminContactSubmissionQueryState,
  type ContactSubmissionStatus,
} from "@/features/admin/query/contact-submission-query";
import {
  bulkUpdateContactSubmissionStatus,
  listContactSubmissions,
  updateContactSubmissionStatus,
} from "@/server/db/dal/contact-submission";
import { resolvePaginatedView } from "../pagination";

export async function listAdminContactSubmissionsView({
  page,
  state,
}: {
  page: number;
  state: AdminContactSubmissionQueryState;
}) {
  const result = await resolvePaginatedView({
    limit: ADMIN_CONTACT_SUBMISSION_PAGE_SIZE,
    page,
    loadPage: async ({ limit, offset }) => {
      const result = await listContactSubmissions({
        limit,
        offset,
        state,
      });

      return {
        items: result.submissions,
        total: result.total,
      };
    },
  });

  return {
    ...result.pagination,
    submissions: result.items,
  };
}

export async function updateAdminContactSubmissionStatus({
  id,
  status,
}: {
  id: string;
  status: ContactSubmissionStatus;
}) {
  await updateContactSubmissionStatus({ id, status });
}

export async function bulkUpdateAdminContactSubmissionStatus({
  fromStatus,
  state,
  status,
}: {
  fromStatus?: ContactSubmissionStatus;
  state: AdminContactSubmissionQueryState;
  status: ContactSubmissionStatus;
}) {
  await bulkUpdateContactSubmissionStatus({ fromStatus, state, status });
}
