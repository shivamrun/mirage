import { Elysia } from "elysia";

import { env } from "@/lib/env";
import {
  cancelPendingEmailChange,
  changeAccountEmail,
  getAccountEmailState,
  resendAccountVerification,
  resolveEmailChangeConfirmationRedirectURL,
} from "@/server/account/email-change";
import { changeEmailSchema } from "@/zod";

function unauthorizedResponse() {
  return Response.json({ message: "Unauthorized" }, { status: 401 });
}

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

export const accountRoutes = new Elysia({ prefix: "/account" })
  .get("/", async ({ request }) => {
    const result = await getAccountEmailState({
      headers: request.headers,
    });

    if (result.kind === "unauthorized") {
      return unauthorizedResponse();
    }

    return result.value;
  })
  .get("/confirm-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(
        new URL("/account?emailChange=invalid", env.NEXT_PUBLIC_BASE_URL),
      );
    }

    const result = await resolveEmailChangeConfirmationRedirectURL({
      token,
    });

    return Response.redirect(result.redirectURL);
  })
  .post("/change-email", async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const parsed = changeEmailSchema.safeParse({
      ...(body && typeof body === "object" ? body : {}),
      callbackURL: "/email-verification?status=success",
    });

    if (!parsed.success) {
      const message =
        parsed.error.flatten().formErrors[0] ||
        Object.values(parsed.error.flatten().fieldErrors)
          .flat()
          .find(Boolean) ||
        "Invalid email change request.";

      return validationErrorResponse(message);
    }

    const result = await changeAccountEmail({
      body: parsed.data,
      headers: request.headers,
    });

    if (result.kind === "unauthorized") {
      return unauthorizedResponse();
    }

    if (result.kind === "error") {
      return Response.json(
        { message: result.message },
        { status: result.statusCode },
      );
    }

    return {
      status: true,
      ...result.value,
    };
  })
  .post("/cancel-email-change", async ({ request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const result = await cancelPendingEmailChange({
      headers: request.headers,
    });

    if (result.kind === "unauthorized") {
      return unauthorizedResponse();
    }

    if (result.kind === "error") {
      return Response.json(
        { message: result.message },
        { status: result.statusCode },
      );
    }

    return {
      status: true,
      ...result.value,
    };
  })
  .post("/resend-verification", async ({ request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const result = await resendAccountVerification({
      headers: request.headers,
    });

    if (result.kind === "unauthorized") {
      return unauthorizedResponse();
    }

    if (result.kind === "error") {
      return Response.json(
        { message: result.message },
        { status: result.statusCode },
      );
    }

    return {
      status: true,
      ...result.value,
    };
  });
