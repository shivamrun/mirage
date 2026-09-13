import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import {
  messageResponseSchema,
  protectedRouteVerificationResponseSchema,
  protectedRouteVerificationSchema,
} from "@/zod";

const protectedRoutePrefixes = ["/admin"];

function isProtectedAccessPath(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function sanitizeProtectedCallbackURL(value?: string) {
  if (!value?.startsWith("/")) {
    return "/";
  }

  const url = new URL(value, env.NEXT_PUBLIC_BASE_URL);

  if (!isProtectedAccessPath(url.pathname)) {
    return "/";
  }

  url.searchParams.delete("verificationEmail");

  return `${url.pathname}${url.search}${url.hash}`;
}

function createVerificationSentURL(callbackURL: string) {
  const url = new URL(callbackURL, env.NEXT_PUBLIC_BASE_URL);
  url.searchParams.set("verificationEmail", "sent");

  return `${url.pathname}${url.search}${url.hash}`;
}

export const authActionRoutes = new Elysia({ prefix: "/auth-actions" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .post(
    "/protected-route-verification-email",
    async ({ authSession, body, request, status }) => {
      const callbackURL = sanitizeProtectedCallbackURL(body.callbackURL);

      if (authSession.user.emailVerified) {
        return {
          redirectURL: callbackURL,
          status: true as const,
        };
      }

      try {
        await auth.api.sendVerificationEmail({
          body: {
            callbackURL,
            email: authSession.user.email,
          },
          headers: request.headers,
        });
      } catch {
        return status(500, {
          message: "We could not send the verification link. Please try again.",
        });
      }

      return {
        redirectURL: createVerificationSentURL(callbackURL),
        status: true as const,
      };
    },
    {
      auth: true,
      sameOrigin: true,
      body: protectedRouteVerificationSchema,
      response: {
        200: protectedRouteVerificationResponseSchema,
        400: messageResponseSchema,
        401: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
