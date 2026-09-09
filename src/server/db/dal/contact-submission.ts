import { asc, desc, ilike, or } from "drizzle-orm";

import type { AdminContactSubmissionQueryState } from "@/components/admin/contact-submission";
import db from "@/server/db";
import { contactSubmission } from "@/server/db/schema";
import type { ContactSubmissionValues } from "@/zod";

type ListContactSubmissionsOptions = {
  state: AdminContactSubmissionQueryState;
};

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
  const query = state.query.trim();
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

  if (query) {
    const pattern = `%${query}%`;

    submissionsQuery = submissionsQuery.where(
      or(
        ilike(contactSubmission.name, pattern),
        ilike(contactSubmission.email, pattern),
        ilike(contactSubmission.company, pattern),
        ilike(contactSubmission.message, pattern),
      ),
    );
  }

  return submissionsQuery.orderBy(
    desc(contactSubmission.createdAt),
    asc(contactSubmission.id),
  );
}
