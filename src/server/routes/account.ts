import { Elysia } from "elysia";

import { env } from "@/lib/env";
import {
  cancelPendingEmailChange,
  changeAccountEmail,
  getAccountEmailState,
  resendAccountVerification,
  resolveEmailChangeApprovalRedirectURL,
  resolveEmailChangeConfirmationRedirectURL,
} from "@/server/account/email-change";
import { changeEmailSchema } from "@/zod";

import { elysiaAuth } from "./auth";

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
  .use(elysiaAuth)
  .get(
    "/",
    async ({ authSession }) => {
      const result = await getAccountEmailState({
        authSession,
      });

      return result.value;
    },
    {
      auth: true,
    },
  )
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
  .get("/approve-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(
        new URL("/account?emailChange=invalid", env.NEXT_PUBLIC_BASE_URL),
      );
    }

    const result = await resolveEmailChangeApprovalRedirectURL({ token });

    return Response.redirect(result.redirectURL);
  })
  .post(
    "/change-email",
    async ({ authSession, body, request }) => {
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
        authSession,
        body: parsed.data,
      });

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
    },
    {
      auth: true,
    },
  )
  .post(
    "/cancel-email-change",
    async ({ authSession, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const result = await cancelPendingEmailChange({
        authSession,
      });

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
    },
    {
      auth: true,
    },
  )
  .post(
    "/resend-verification",
    async ({ authSession, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const result = await resendAccountVerification({
        authSession,
        headers: request.headers,
      });

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
    },
    {
      auth: true,
    },
  );
