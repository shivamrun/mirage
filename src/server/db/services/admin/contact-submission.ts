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

export async function listAdminContactSubmissionsView({
  page,
  state,
}: {
  page: number;
  state: AdminContactSubmissionQueryState;
}) {
  return listContactSubmissions({
    limit: ADMIN_CONTACT_SUBMISSION_PAGE_SIZE,
    page,
    state,
  });
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
