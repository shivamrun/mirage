"use server";

import { revalidatePath } from "next/cache";

import {
  ADMIN_CONTACT_SUBMISSION_PAGE_PATH,
  type AdminContactSubmissionPageSearchParams,
  type ContactSubmissionStatus,
  parseAdminContactSubmissionSearchParams,
} from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import {
  bulkUpdateContactSubmissionStatus,
  updateContactSubmissionStatus,
} from "@/server/db/dal/contact-submission";

const contactSubmissionStatuses = new Set<string>(["archived", "new", "read"]);

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function formStatus(formData: FormData): ContactSubmissionStatus | undefined {
  const status = formString(formData, "status");

  return status && contactSubmissionStatuses.has(status)
    ? (status as ContactSubmissionStatus)
    : undefined;
}

function formFromStatus(
  formData: FormData,
): ContactSubmissionStatus | undefined {
  const status = formString(formData, "fromStatus");

  return status && contactSubmissionStatuses.has(status)
    ? (status as ContactSubmissionStatus)
    : undefined;
}

function formQueryState(formData: FormData) {
  return parseAdminContactSubmissionSearchParams({
    filterField: formString(formData, "filterField"),
    filterValue: formString(formData, "filterValue"),
    q: formString(formData, "q"),
  } satisfies AdminContactSubmissionPageSearchParams);
}

export async function updateContactSubmissionStatusAction(formData: FormData) {
  await requireAdmin();

  const id = formString(formData, "id");
  const status = formStatus(formData);

  if (!id || !status) {
    return;
  }

  await updateContactSubmissionStatus({ id, status });
  revalidatePath(ADMIN_CONTACT_SUBMISSION_PAGE_PATH);
}

export async function bulkUpdateContactSubmissionStatusAction(
  formData: FormData,
) {
  await requireAdmin();

  const status = formStatus(formData);

  if (!status) {
    return;
  }

  await bulkUpdateContactSubmissionStatus({
    fromStatus: formFromStatus(formData),
    state: formQueryState(formData),
    status,
  });
  revalidatePath(ADMIN_CONTACT_SUBMISSION_PAGE_PATH);
}
