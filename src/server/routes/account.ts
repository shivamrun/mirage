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
import { requestPolicy } from "./request-policy";
import { type MutationError, mutationErrorResponse } from "./responses";

function validationErrorResponse(message: string) {
  return Response.json({ message }, { status: 400 });
}

const twoFactorEmailCodeActionSchema = z.object({
  action: z.enum(["enable", "disable"]),
});

const twoFactorCodeSchema = z.object({
  code: z.string().min(1),
});

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
  result: ({ kind: "error" } & MutationError) | ({ kind: "success" } & T),
) {
  if (result.kind === "error") {
    return mutationErrorResponse(result);
  }

  const { kind: _kind, ...data } = result;

  return {
    status: true,
    ...data,
  };
}

export const accountRoutes = new Elysia({ prefix: "/account" })
  .use(elysiaAuth)
  .use(requestPolicy)
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
    async ({ authSession, body }) => {
      const parsed = parseBody(
        twoFactorEmailCodeActionSchema,
        body,
        "Two-factor action is required.",
      );

      if (parsed.error) {
        return parsed.error;
      }

      const result = await sendAccountTwoFactorEmailCode({
        action: parsed.data.action,
        authSession,
      });
      if (result.kind === "error" && result.recovery) {
        return Response.json(
          { message: result.message, recovery: result.recovery },
          { status: result.statusCode },
        );
      }
      return accountMutationResponse(result);
    },
    {
      auth: true,
      sameOrigin: true,
    },
  )
  .post(
    "/two-factor/start-setup",
    async ({ authSession, body }) => {
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
      sameOrigin: true,
    },
  )
  .post(
    "/two-factor/verify-setup",
    async ({ authSession, body }) => {
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
      sameOrigin: true,
    },
  )
  .post(
    "/two-factor/disable",
    async ({ authSession, body }) => {
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
      sameOrigin: true,
    },
  )
  .get("/confirm-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(invalidEmailChangePageURL());
    }

    return Response.redirect(emailChangePageURL({ action: "confirm", token }));
  })
  .post(
    "/confirm-email-change",
    async ({ body }) => {
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
    },
    {
      sameOrigin: true,
    },
  )
  .get("/approve-email-change", async ({ query }) => {
    const token = typeof query.token === "string" ? query.token : "";

    if (!token) {
      return Response.redirect(invalidEmailChangePageURL());
    }

    return Response.redirect(emailChangePageURL({ action: "approve", token }));
  })
  .post(
    "/approve-email-change",
    async ({ body }) => {
      const parsed = parseEmailChangeToken(body);

      if (parsed.error) {
        return parsed.error;
      }

      const result = await resolveEmailChangeApprovalRedirectURL({
        token: parsed.token,
      });

      if (result.retryAfterSeconds) {
        return mutationErrorResponse({
          message:
            "Please wait before requesting another email change message.",
          retryAfterSeconds: result.retryAfterSeconds,
          statusCode: 429,
        });
      }

      if (result.deliveryFailed) {
        return Response.json(
          {
            message:
              "Your approval was saved, but we could not confirm delivery to the new address. Sign in and resend verification from your account after a minute if the message does not arrive.",
            recovery: "resend-from-account",
          },
          { status: 503 },
        );
      }

      return {
        status: true,
        redirectURL: result.redirectURL,
      };
    },
    {
      sameOrigin: true,
    },
  )
  .post(
    "/change-email",
    async ({ authSession, body }) => {
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
        return mutationErrorResponse(result);
      }

      return {
        status: true,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
    },
  )
  .post(
    "/cancel-email-change",
    async ({ authSession }) => {
      const result = await cancelPendingEmailChange({
        authSession,
      });

      if (result.kind === "error") {
        return mutationErrorResponse(result);
      }

      return {
        status: true,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
    },
  )
  .post(
    "/resend-verification",
    async ({ authSession, request }) => {
      const result = await resendAccountVerification({
        authSession,
        headers: request.headers,
      });

      if (result.kind === "error") {
        return mutationErrorResponse(result);
      }

      return {
        status: true,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
    },
  )
  .post(
    "/resend-email-change-verification",
    async ({ authSession }) => {
      const result = await resendPendingEmailChangeVerification({
        authSession,
      });

      if (result.kind === "error") {
        return mutationErrorResponse(result);
      }

      return {
        status: true,
        ...result.value,
      };
    },
    {
      auth: true,
      sameOrigin: true,
    },
  );
