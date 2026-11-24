import { Elysia } from "elysia";
import {
  confirmEmailListVerification,
  subscribeToEmailList,
} from "@/server/db/services/email-list/service";
import { requestPolicy } from "@/server/http/request-policy";
import { env } from "@/shared/env";
import {
  emailListSignupSuccessResponseSchema,
  emailListVerifyQuerySchema,
  emailSubscriptionSchema,
  messageResponseSchema,
} from "@/shared/schemas";

function createEmailListRedirectUrl(status: "invalid" | "success") {
  const url = new URL("/", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("emailListVerification", status);

  return url.toString();
}

export const emailListRoutes = new Elysia({ prefix: "/email-list" })
  .use(requestPolicy)
  .post(
    "/",
    async ({ body, set, status }) => {
      const result = await subscribeToEmailList(body);

      if (result.status === "ignored") {
        return { status: true as const };
      }

      if (result.status === "rate-limited") {
        set.headers["Retry-After"] = String(result.retryAfterSeconds);
        return status(429, {
          message: "Too many email signups. Please try again later.",
        });
      }

      if (result.status === "unknown-list") {
        return status(400, { message: "Unknown email list." });
      }

      if (result.status === "delivery-failed") {
        return status(503, {
          message:
            "Verification email could not be sent. Please try signing up again.",
        });
      }

      return {
        status: true as const,
        verificationRequired: result.status === "pending-verification",
      };
    },
    {
      sameOrigin: true,
      body: emailSubscriptionSchema,
      routeLimit: "email-list-signup",
      response: {
        200: emailListSignupSuccessResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
        503: messageResponseSchema,
      },
    },
  )
  .get(
    "/verify",
    async ({ query }) => {
      const token = query.token ?? "";
      const result = await confirmEmailListVerification(token);

      return Response.redirect(createEmailListRedirectUrl(result.status), 302);
    },
    {
      query: emailListVerifyQuerySchema,
    },
  );
