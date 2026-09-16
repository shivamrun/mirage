import type {
  AdminContactSubmissionQueryState,
  ContactSubmissionStatus,
} from "@/features/admin/query/contact-submission-query";
import {
  bulkUpdateContactSubmissionStatus,
  listContactSubmissions,
  updateContactSubmissionStatus,
} from "@/server/db/dal/contact-submission";

export async function listAdminContactSubmissionsView({
  state,
}: {
  state: AdminContactSubmissionQueryState;
}) {
  return listContactSubmissions({ state });
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
