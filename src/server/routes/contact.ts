import { Elysia } from "elysia";

import { createContactSubmission } from "@/server/db/dal/contact-submission";
import { requestPolicy } from "@/server/http/request-policy";
import {
  consumePublicWriteLimit,
  getPublicClientIdentifier,
} from "@/server/rate-limit";
import {
  contactSubmissionSchema,
  contactSuccessResponseSchema,
  messageResponseSchema,
} from "@/zod";

export const contactRoutes = new Elysia({ prefix: "/contact" })
  .use(requestPolicy)
  .post(
    "/",
    async ({ body, request, set, status }) => {
      if (body.website) {
        return { status: true as const };
      }

      const rateLimit = await consumePublicWriteLimit({
        clientIdentifier: getPublicClientIdentifier(request.headers),
        destination: body.email,
        flow: "contact",
      });
      if (!rateLimit.allowed) {
        set.headers["Retry-After"] = String(rateLimit.retryAfterSeconds);
        return status(429, {
          message: "Too many contact submissions. Please try again later.",
        });
      }

      await createContactSubmission(body);

      return { status: true as const };
    },
    {
      sameOrigin: true,
      body: contactSubmissionSchema,
      response: {
        200: contactSuccessResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
