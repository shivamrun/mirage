import { Elysia } from "elysia";

import { submitContactForm } from "@/server/contact/service";
import { requestPolicy } from "@/server/http/request-policy";
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
      const result = await submitContactForm({
        headers: request.headers,
        values: body,
      });

      if (result.status === "rate-limited") {
        set.headers["Retry-After"] = String(result.retryAfterSeconds);
        return status(429, {
          message: "Too many contact submissions. Please try again later.",
        });
      }

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
