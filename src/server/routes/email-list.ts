import { Elysia } from "elysia";

import { env } from "@/lib/env";
import {
  confirmEmailListVerification,
  createEmailListVerification,
  deleteEmailListVerification,
  deletePendingEmailSubscription,
  subscribeEmailToList,
} from "@/server/db/dal/email-list";
import { sendEmailListVerificationEmail } from "@/server/email";
import { emailSubscriptionSchema } from "@/zod";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 8;
const emailListRateLimits = new Map<
  string,
  { count: number; resetAt: number }
>();

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

function forbiddenResponse() {
  return Response.json({ message: "Invalid request origin." }, { status: 403 });
}

function rateLimitResponse() {
  return Response.json(
    { message: "Too many email signups. Please try again later." },
    { status: 429 },
  );
}

function getRequestIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const identifier = getRequestIdentifier(request);

  for (const [key, entry] of emailListRateLimits) {
    if (entry.resetAt <= now) {
      emailListRateLimits.delete(key);
    }
  }

  const current = emailListRateLimits.get(identifier);

  if (!current || current.resetAt <= now) {
    emailListRateLimits.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }

  if (current.count >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return rateLimitResponse();
  }

  current.count += 1;
  return null;
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

    const rateLimitError = checkRateLimit(request);

    if (rateLimitError) {
      return rateLimitError;
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

        await sendEmailListVerificationEmail({
          email: subscription.contact.email,
          listKey: subscription.subscription.listKey,
          listName: subscription.list.name,
          verificationUrl: createEmailListVerificationUrl(verification.token),
        }).catch(async (error: unknown) => {
          await deleteEmailListVerification(verification.token);

          if (!subscription.subscriptionExisted) {
            await deletePendingEmailSubscription(subscription.subscription.id);
          }

          throw error;
        });
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
