import { and, asc, desc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import type {
  AdminContactSubmissionQueryState,
  ContactSubmissionStatus,
} from "@/features/admin/query/contact-submission-query";
import db from "@/server/db";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import { contactSubmission } from "@/server/db/schema";
import type { ContactSubmissionValues } from "@/shared/schemas";

type ListContactSubmissionsOptions = {
  limit: number;
  offset: number;
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
  limit,
  offset,
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
  let totalQuery = db
    .select({ total: totalCount })
    .from(contactSubmission)
    .$dynamic();

  if (whereClause) {
    submissionsQuery = submissionsQuery.where(whereClause);
    totalQuery = totalQuery.where(whereClause);
  }

  const result = await paginateList({
    countQuery: totalQuery,
    limit,
    offset,
    query: submissionsQuery.orderBy(
      desc(contactSubmission.createdAt),
      asc(contactSubmission.id),
    ),
  });

  return {
    limit,
    offset,
    submissions: result.items,
    total: result.total,
  };
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
