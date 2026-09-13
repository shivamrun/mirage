import { and, asc, desc, eq, ilike, ne, or, type SQL } from "drizzle-orm";

import type {
  AdminContactSubmissionQueryState,
  ContactSubmissionStatus,
} from "@/lib/admin/contact-submission-query";
import db from "@/server/db";
import { contactSubmission } from "@/server/db/schema";
import type { ContactSubmissionValues } from "@/zod";

type ListContactSubmissionsOptions = {
  state: AdminContactSubmissionQueryState;
};

type UpdateContactSubmissionStatusOptions = {
  id: string;
  status: ContactSubmissionStatus;
};

type BulkUpdateContactSubmissionStatusOptions = {
  fromStatus?: ContactSubmissionStatus;
  state: AdminContactSubmissionQueryState;
  status: ContactSubmissionStatus;
};

function getListSearchCondition(state: AdminContactSubmissionQueryState) {
  const query = state.query.trim();

  if (!query) {
    return;
  }

  const pattern = `%${query}%`;

  return or(
    ilike(contactSubmission.name, pattern),
    ilike(contactSubmission.email, pattern),
    ilike(contactSubmission.company, pattern),
    ilike(contactSubmission.message, pattern),
  );
}

function getListStatusCondition(state: AdminContactSubmissionQueryState) {
  if (!state.filterValue) {
    return;
  }

  return eq(contactSubmission.status, state.filterValue);
}

function getWhereClause(state: AdminContactSubmissionQueryState) {
  const conditions = [
    getListSearchCondition(state),
    getListStatusCondition(state),
  ].filter((condition): condition is SQL => Boolean(condition));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function createContactSubmission(values: ContactSubmissionValues) {
  const [submission] = await db
    .insert(contactSubmission)
    .values({
      name: values.name,
      email: values.email,
      company: values.company,
      message: values.message,
    })
    .returning({
      id: contactSubmission.id,
      createdAt: contactSubmission.createdAt,
    });

  return submission;
}

export async function listContactSubmissions({
  state,
}: ListContactSubmissionsOptions) {
  const whereClause = getWhereClause(state);
  let submissionsQuery = db
    .select({
      company: contactSubmission.company,
      createdAt: contactSubmission.createdAt,
      email: contactSubmission.email,
      id: contactSubmission.id,
      message: contactSubmission.message,
      name: contactSubmission.name,
      status: contactSubmission.status,
    })
    .from(contactSubmission)
    .$dynamic();

  if (whereClause) {
    submissionsQuery = submissionsQuery.where(whereClause);
  }

  return submissionsQuery.orderBy(
    desc(contactSubmission.createdAt),
    asc(contactSubmission.id),
  );
}

export async function updateContactSubmissionStatus({
  id,
  status,
}: UpdateContactSubmissionStatusOptions) {
  await db
    .update(contactSubmission)
    .set({ status })
    .where(eq(contactSubmission.id, id));
}

export async function bulkUpdateContactSubmissionStatus({
  fromStatus,
  state,
  status,
}: BulkUpdateContactSubmissionStatusOptions) {
  const whereClause = getWhereClause(state);
  const statusCondition = fromStatus
    ? eq(contactSubmission.status, fromStatus)
    : ne(contactSubmission.status, status);
  const updateCondition = whereClause
    ? and(whereClause, statusCondition)
    : statusCondition;

  await db.update(contactSubmission).set({ status }).where(updateCondition);
}
