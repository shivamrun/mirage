import { Elysia } from "elysia";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

import { elysiaAuth } from "./auth";
import { requestPolicy } from "./request-policy";

const protectedRoutePrefixes = ["/admin"];

const protectedRouteVerificationSchema = z.object({
  callbackURL: z.string().optional(),
});

function jsonResponse(message: string, status: number) {
  return Response.json({ message }, { status });
}

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
    async ({ authSession, body, request }) => {
      const parsed = protectedRouteVerificationSchema.safeParse(
        body && typeof body === "object" ? body : {},
      );

      if (!parsed.success) {
        return jsonResponse("Invalid verification request.", 400);
      }

      const callbackURL = sanitizeProtectedCallbackURL(parsed.data.callbackURL);

      if (authSession.user.emailVerified) {
        return {
          redirectURL: callbackURL,
          status: true,
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
        return jsonResponse(
          "We could not send the verification link. Please try again.",
          500,
        );
      }

      return {
        redirectURL: createVerificationSentURL(callbackURL),
        status: true,
      };
    },
    {
      auth: true,
      sameOrigin: true,
    },
  );
