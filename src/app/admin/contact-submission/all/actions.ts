"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_CONTACT_SUBMISSION_PAGE_PATH } from "@/lib/admin/contact-submission-query";
import { requireVerifiedAdmin } from "@/lib/auth/access";
import {
  bulkUpdateAdminContactSubmissionStatus,
  updateAdminContactSubmissionStatus,
} from "@/server/admin/contact-submission";
import {
  bulkUpdateContactSubmissionStatusActionSchema,
  updateContactSubmissionStatusActionSchema,
} from "@/zod/contact-submission";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

export async function updateContactSubmissionStatusAction(formData: FormData) {
  await requireVerifiedAdmin();

  const { id, status } = updateContactSubmissionStatusActionSchema.parse({
    id: formString(formData, "id"),
    status: formString(formData, "status"),
  });

  await updateAdminContactSubmissionStatus({ id, status });
  revalidatePath(ADMIN_CONTACT_SUBMISSION_PAGE_PATH);
}

export async function bulkUpdateContactSubmissionStatusAction(
  formData: FormData,
) {
  await requireVerifiedAdmin();

  const values = bulkUpdateContactSubmissionStatusActionSchema.parse({
    filterField: formString(formData, "filterField"),
    filterValue: formString(formData, "filterValue"),
    fromStatus: formString(formData, "fromStatus"),
    q: formString(formData, "q"),
    status: formString(formData, "status"),
  });

  await bulkUpdateAdminContactSubmissionStatus({
    fromStatus: values.fromStatus,
    state: {
      filterField: "status",
      filterValue: values.filterField === "status" ? values.filterValue : "",
      query: values.q,
    },
    status: values.status,
  });
  revalidatePath(ADMIN_CONTACT_SUBMISSION_PAGE_PATH);
}
