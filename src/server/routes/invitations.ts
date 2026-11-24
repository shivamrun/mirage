import { Elysia } from "elysia";
import { signupAttributionHeader } from "@/adapters/analytics/events";
import {
  acceptInvitationSignup,
  validateInvitationToken,
} from "@/server/db/services/invitations/service";
import { requestPolicy } from "@/server/http/request-policy";
import {
  acceptInvitationSignupResponseSchema,
  acceptInvitationSignupSchema,
  messageResponseSchema,
  publicInvitationValidateResponseSchema,
  publicInvitationValidateSchema,
} from "@/shared/schemas";

function appendSetCookieHeaders(
  target: Record<string, number | string | string[]>,
  source: Headers,
) {
  const getSetCookie = (
    source as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.bind(source);
  const cookies =
    typeof getSetCookie === "function"
      ? getSetCookie()
      : source.get("set-cookie")
        ? [source.get("set-cookie") as string]
        : [];

  if (cookies.length === 0) {
    return;
  }

  const existing = target["set-cookie"];
  target["set-cookie"] = Array.isArray(existing)
    ? [...existing, ...cookies]
    : existing
      ? [String(existing), ...cookies]
      : cookies;
}

export const invitationRoutes = new Elysia()
  .use(requestPolicy)
  .post(
    "/invitations/validate",
    async ({ body }) => validateInvitationToken(body.token),
    {
      sameOrigin: true,
      routeLimit: "invitation-validate",
      body: publicInvitationValidateSchema,
      response: {
        200: publicInvitationValidateResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/invitations/accept-signup",
    async ({ body, request, set, status }) => {
      const headers = new Headers(request.headers);
      if (body.attribution) {
        headers.set(
          signupAttributionHeader,
          encodeURIComponent(JSON.stringify(body.attribution)),
        );
      } else {
        headers.delete(signupAttributionHeader);
      }
      const result = await acceptInvitationSignup({
        callbackURL: body.callbackURL,
        email: body.email,
        headers,
        password: body.password,
        token: body.token,
      });

      if (result.status !== "success") {
        return status(result.statusCode, { message: result.message });
      }

      appendSetCookieHeaders(set.headers, result.headers);

      return {
        redirectTo: result.redirectTo,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      routeLimit: "invitation-accept",
      body: acceptInvitationSignupSchema,
      response: {
        200: acceptInvitationSignupResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        409: messageResponseSchema,
        422: messageResponseSchema,
        429: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
