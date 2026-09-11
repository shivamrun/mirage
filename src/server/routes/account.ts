import { Elysia } from "elysia";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  cancelPendingEmailChange,
  changeAccountEmail,
  getAccountEmailState,
  resendAccountVerification,
  resendPendingEmailChangeVerification,
  resolveEmailChangeApprovalRedirectURL,
  resolveEmailChangeConfirmationRedirectURL,
} from "@/server/account/email-change";
import { getConnectedGoogleAccount } from "@/server/account/google-account";
import {
  disableAccountTwoFactor,
  sendAccountTwoFactorEmailCode,
  startAccountTwoFactorSetup,
  verifyAccountTwoFactorSetup,
} from "@/server/account/two-factor";
import { changeEmailSchema, emailChangeTokenSchema } from "@/zod";

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

const twoFactorEmailCodeActionSchema = z.object({
  action: z.enum(["enable", "disable"]),
});

const twoFactorCodeSchema = z.object({
  code: z.string().min(1),
});

// TODO(rate-limit): Throttle email delivery and email-change mutations when
// application rate limiting is introduced.

function emailChangePageURL({
  action,
  token,
}: {
  action: "approve" | "confirm";
  token: string;
}) {
  const url = new URL("/email-change", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  return url;
}

function invalidEmailChangePageURL() {
  const url = new URL("/email-change", env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("status", "invalid");
  return url;
}

function parseEmailChangeToken(body: unknown) {
  const parsed = emailChangeTokenSchema.safeParse(
    body && typeof body === "object" ? body : {},
  );

  if (!parsed.success) {
    return {
      error: validationErrorResponse(
        parsed.error.flatten().fieldErrors.token?.[0] ||
          "Email change token is required.",
      ),
    };
  }

  return { token: parsed.data.token };
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown, fallback: string) {
  const parsed = schema.safeParse(body && typeof body === "object" ? body : {});

  if (!parsed.success) {
    const fieldMessage = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .find((value): value is string => typeof value === "string");
    const message =
      parsed.error.flatten().formErrors[0] || fieldMessage || fallback;

    return { error: validationErrorResponse(message) };
  }

  return { data: parsed.data };
}

function accountMutationResponse<T extends Record<string, unknown>>(
  result:
    | { kind: "error"; message: string; statusCode: number }
    | ({ kind: "success" } & T),
) {
  if (result.kind === "error") {
    return Response.json(
      { message: result.message },
      { status: result.statusCode },
    );
  }

  const { kind: _kind, ...data } = result;

  return {
    status: true,
    ...data,
  };
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
  .get(
    "/google-account",
    async ({ authSession }) => {
      const connectedAccount = await getConnectedGoogleAccount({
        authSession,
      });

      return {
        account: connectedAccount,
      };
    },
    {
      auth: true,
    },
  )
  .post(
    "/two-factor/send-code",
    async ({ authSession, body, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const parsed = parseBody(
        twoFactorEmailCodeActionSchema,
        body,
        "Two-factor action is required.",
      );

      if (parsed.error) {
        return parsed.error;
      }

      return accountMutationResponse(
        await sendAccountTwoFactorEmailCode({
          action: parsed.data.action,
          authSession,
        }),
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/two-factor/start-setup",
    async ({ authSession, body, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const parsed = parseBody(
        twoFactorCodeSchema,
        body,
        "Email code is required.",
      );

      if (parsed.error) {
        return parsed.error;
      }

      return accountMutationResponse(
        await startAccountTwoFactorSetup({
          authSession,
          code: parsed.data.code,
        }),
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/two-factor/verify-setup",
    async ({ authSession, body, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const parsed = parseBody(
        twoFactorCodeSchema,
        body,
        "Authenticator code is required.",
      );

      if (parsed.error) {
        return parsed.error;
      }

      return accountMutationResponse(
        await verifyAccountTwoFactorSetup({
          authSession,
          code: parsed.data.code,
        }),
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/two-factor/disable",
    async ({ authSession, body, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const parsed = parseBody(
        twoFactorCodeSchema,
        body,
        "Email code is required.",
      );

      if (parsed.error) {
        return parsed.error;
      }

      return accountMutationResponse(
        await disableAccountTwoFactor({
          authSession,
          code: parsed.data.code,
        }),
      );
    },
    {
      auth: true,
    },
  )
  .get("/confirm-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(invalidEmailChangePageURL());
    }

    return Response.redirect(emailChangePageURL({ action: "confirm", token }));
  })
  .post("/confirm-email-change", async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const parsed = parseEmailChangeToken(body);

    if (parsed.error) {
      return parsed.error;
    }

    const result = await resolveEmailChangeConfirmationRedirectURL({
      token: parsed.token,
    });

    return {
      status: true,
      redirectURL: result.redirectURL,
    };
  })
  .get("/approve-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(invalidEmailChangePageURL());
    }

    return Response.redirect(emailChangePageURL({ action: "approve", token }));
  })
  .post("/approve-email-change", async ({ body, request }) => {
    const invalidMutationResponse = validateMutationRequest(request);

    if (invalidMutationResponse) {
      return invalidMutationResponse;
    }

    const parsed = parseEmailChangeToken(body);

    if (parsed.error) {
      return parsed.error;
    }

    const result = await resolveEmailChangeApprovalRedirectURL({
      token: parsed.token,
    });

    return {
      status: true,
      redirectURL: result.redirectURL,
    };
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
  )
  .post(
    "/resend-email-change-verification",
    async ({ authSession, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const result = await resendPendingEmailChangeVerification({
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
  );
