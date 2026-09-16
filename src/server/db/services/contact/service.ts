import {
  consumePublicWriteLimit,
  getPublicClientIdentifier,
} from "@/adapters/rate-limit";
import { createContactSubmission } from "@/server/db/dal/contact-submission";
import type { ContactSubmissionValues } from "@/shared/schemas";

type SubmitContactFormResult =
  | {
      status: "success";
    }
  | {
      status: "ignored";
    }
  | {
      retryAfterSeconds: number;
      status: "rate-limited";
    };

export async function submitContactForm({
  headers,
  values,
}: {
  headers: Headers;
  values: ContactSubmissionValues;
}): Promise<SubmitContactFormResult> {
  if (values.website) {
    return { status: "ignored" };
  }

  const rateLimit = await consumePublicWriteLimit({
    clientIdentifier: getPublicClientIdentifier(headers),
    destination: values.email,
    flow: "contact",
  });
  if (!rateLimit.allowed) {
    return {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      status: "rate-limited",
    };
  }

  await createContactSubmission(values);

  return { status: "success" };
}
