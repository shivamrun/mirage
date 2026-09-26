import { Elysia } from "elysia";
import { compactAnalyticsAttribution } from "@/adapters/analytics/events";
import { analytics } from "@/adapters/analytics/server";
import { submitContactForm } from "@/server/db/services/contact/service";
import { requestPolicy } from "@/server/http/request-policy";
import { verifyTurnstileToken } from "@/server/http/turnstile";
import {
  contactSubmissionSchema,
  contactSuccessResponseSchema,
  messageResponseSchema,
} from "@/shared/schemas";

export const contactRoutes = new Elysia({ prefix: "/contact" })
  .use(requestPolicy)
  .post(
    "/",
    async ({ body, request, set, status }) => {
      const turnstile = await verifyTurnstileToken({
        action: "contact",
        headers: request.headers,
        token: body.turnstileToken,
      });

      if (turnstile.status === "failed") {
        return status(403, { message: turnstile.message });
      }

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

      if (result.status === "success") {
        void analytics.track(
          "contact_submitted",
          {
            attribution: compactAnalyticsAttribution(body.attribution),
            hasCompany: Boolean(body.company),
          },
          { context: { url: "/contact" } },
        );
      }

      return { status: true as const };
    },
    {
      sameOrigin: true,
      body: contactSubmissionSchema,
      routeLimit: "contact-submit",
      response: {
        200: contactSuccessResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
