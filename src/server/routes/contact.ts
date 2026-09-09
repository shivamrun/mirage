import { Elysia } from "elysia";

import { env } from "@/lib/env";
import { createContactSubmission } from "@/server/db/dal/contact-submission";
import { contactSubmissionSchema } from "@/zod";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const contactRateLimits = new Map<string, { count: number; resetAt: number }>();

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

function forbiddenResponse() {
  return Response.json({ message: "Invalid request origin." }, { status: 403 });
}

function rateLimitResponse() {
  return Response.json(
    { message: "Too many contact submissions. Please try again later." },
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

  for (const [key, entry] of contactRateLimits) {
    if (entry.resetAt <= now) {
      contactRateLimits.delete(key);
    }
  }

  const current = contactRateLimits.get(identifier);

  if (!current || current.resetAt <= now) {
    contactRateLimits.set(identifier, {
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

export const contactRoutes = new Elysia({ prefix: "/contact" }).post(
  "/",
  async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const rateLimitError = checkRateLimit(request);

    if (rateLimitError) {
      return rateLimitError;
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

    await createContactSubmission(parsed.data);

    return { status: true };
  },
);
