import { Elysia } from "elysia";

import { env } from "@/lib/env";
import {
  confirmEmailListVerification,
  createEmailListVerification,
  deleteEmailListVerification,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import { sendEmailListVerificationEmail } from "@/server/email";
import { consumePublicWriteLimit } from "@/server/rate-limit";
import { emailSubscriptionSchema } from "@/zod";
import { rateLimitResponse } from "./responses";

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

function forbiddenResponse() {
  return Response.json({ message: "Invalid request origin." }, { status: 403 });
}

function isTrustedOriginRequest(request: Request) {
  const trustedOrigin = new URL(env.NEXT_PUBLIC_BASE_URL).origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === trustedOrigin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}

function validateMutationRequest(request: Request) {
  return isTrustedOriginRequest(request) ? null : forbiddenResponse();
}

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
  .post("/", async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const parsed = emailSubscriptionSchema.safeParse(
      body && typeof body === "object" ? body : {},
    );

    if (!parsed.success) {
      const message =
        parsed.error.flatten().formErrors[0] ||
        Object.values(parsed.error.flatten().fieldErrors)
          .flat()
          .find(Boolean) ||
        "Invalid email signup.";

      return validationErrorResponse(message);
    }

    if (parsed.data.website) {
      return { status: true };
    }

    const rateLimit = await consumePublicWriteLimit({
      destination: parsed.data.email,
      flow: "email-list",
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(
        "Too many email signups. Please try again later.",
        rateLimit.retryAfterSeconds,
      );
    }

    try {
      const subscription = await subscribeEmailToList(parsed.data);
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
            verificationUrl: createEmailListVerificationUrl(verification.token),
          });
        } catch {
          await deleteEmailListVerification(verification.token);
          return Response.json(
            {
              message:
                "Verification email could not be sent. Please try signing up again.",
            },
            { status: 503 },
          );
        }
      }

      return {
        status: true,
        verificationRequired,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Unknown email list.") {
        return validationErrorResponse("Unknown email list.");
      }

      throw error;
    }
  })
  .get("/verify", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";
    const result = await confirmEmailListVerification(token);

    return Response.redirect(createEmailListRedirectUrl(result.status), 302);
  });
