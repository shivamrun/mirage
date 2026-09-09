import db from "@/server/db";
import { contactSubmission } from "@/server/db/schema";
import type { ContactSubmissionValues } from "@/zod";

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
