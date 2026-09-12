import { Elysia } from "elysia";

import { env } from "@/lib/env";
import { createContactSubmission } from "@/server/db/dal/contact-submission";
import { consumePublicWriteLimit } from "@/server/rate-limit";
import { contactSubmissionSchema } from "@/zod";
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

export const contactRoutes = new Elysia({ prefix: "/contact" }).post(
  "/",
  async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

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
);
