import { Elysia } from "elysia";

import { createContactSubmission } from "@/server/db/dal/contact-submission";
import { consumePublicWriteLimit } from "@/server/rate-limit";
import { contactSubmissionSchema } from "@/zod";
import { requestPolicy } from "./request-policy";
import { rateLimitResponse } from "./responses";

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

export const contactRoutes = new Elysia({ prefix: "/contact" })
  .use(requestPolicy)
  .post(
    "/",
    async ({ body }) => {
      const parsed = contactSubmissionSchema.safeParse(
        body && typeof body === "object" ? body : {},
      );

      if (!parsed.success) {
        const message =
          parsed.error.flatten().formErrors[0] ||
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .find(Boolean) ||
          "Invalid contact submission.";

        return validationErrorResponse(message);
      }

      if (parsed.data.website) {
        return { status: true };
      }

      const rateLimit = await consumePublicWriteLimit({
        destination: parsed.data.email,
        flow: "contact",
      });
      if (!rateLimit.allowed) {
        return rateLimitResponse(
          "Too many contact submissions. Please try again later.",
          rateLimit.retryAfterSeconds,
        );
      }

      await createContactSubmission(parsed.data);

      return { status: true };
    },
    {
      sameOrigin: true,
    },
  );
