import { Elysia } from "elysia";

import { env } from "@/lib/env";
import {
  confirmEmailListVerification,
  createEmailListVerification,
  deleteEmailListVerification,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import { sendEmailListVerificationEmail } from "@/server/email";
import { requestPolicy } from "@/server/http/request-policy";
import { consumePublicWriteLimit } from "@/server/rate-limit";
import {
  emailListSignupSuccessResponseSchema,
  emailListVerifyQuerySchema,
  emailSubscriptionSchema,
  messageResponseSchema,
} from "@/zod";

function createEmailListVerificationUrl(token: string) {
  const url = new URL("/api/email-list/verify", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("token", token);

  return url.toString();
}

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
      if (body.website) {
        return { status: true as const };
      }

      const rateLimit = await consumePublicWriteLimit({
        destination: body.email,
        flow: "email-list",
      });
      if (!rateLimit.allowed) {
        set.headers["Retry-After"] = String(rateLimit.retryAfterSeconds);
        return status(429, {
          message: "Too many email signups. Please try again later.",
        });
      }

      try {
        const subscription = await subscribeEmailToList(body);
        const verificationRequired =
          subscription.subscription.status === "pending";

        if (verificationRequired) {
          const verification = await createEmailListVerification({
            email: subscription.contact.email,
            listKey: subscription.subscription.listKey,
            subscriptionId: subscription.subscription.id,
          });

          try {
            await sendEmailListVerificationEmail({
              email: subscription.contact.email,
              listKey: subscription.subscription.listKey,
              listName: subscription.list.name,
              verificationUrl: createEmailListVerificationUrl(
                verification.token,
              ),
            });
          } catch {
            await deleteEmailListVerification(verification.token);
            return status(503, {
              message:
                "Verification email could not be sent. Please try signing up again.",
            });
          }
        }

        return {
          status: true as const,
          verificationRequired,
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Unknown email list.") {
          return status(400, { message: "Unknown email list." });
        }

        throw error;
      }
    },
    {
      sameOrigin: true,
      body: emailSubscriptionSchema,
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
