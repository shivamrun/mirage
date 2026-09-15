import { Elysia } from "elysia";
import {
  forcePasswordReset,
  revokeAdminUserSession,
  revokeEverySession,
  unlinkAdminLinkedAccount,
} from "@/server/admin/security";
import type { CurrentUser } from "@/server/auth/current-user";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminPasswordResetPartialFailureResponseSchema,
  adminPasswordResetSuccessResponseSchema,
  adminRevokeAllSessionsResponseSchema,
  adminStatusResponseSchema,
  forcePasswordResetSchema,
  linkedAccountParamsSchema,
  messageResponseSchema,
  userSessionParamsSchema,
} from "@/zod";

function getAdminRouteUser(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

export const adminUserSecurityRoutes = new Elysia()
  .use(requestPolicy)
  .delete(
    "/users/:userId/accounts/:accountRowId",
    async (context) => {
      const { params, status } = context;
      const result = await unlinkAdminLinkedAccount({
        accountRowId: params.accountRowId,
        actor: getAdminRouteUser(context),
        userId: params.userId,
      });

      if (result.status === "not-found") {
        return status(404, { message: "Linked account not found." });
      }

      if (result.status === "credential") {
        return status(400, {
          message: "Password credentials cannot be unlinked here.",
        });
      }

      if (result.status === "last-method") {
        return status(403, {
          message: "Cannot unlink the user's last sign-in method.",
        });
      }

      if (result.status === "denied") {
        return status(result.statusCode, { message: result.message });
      }

      return {
        account: result.account,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      params: linkedAccountParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .delete(
    "/users/:userId/sessions/:sessionId",
    async (context) => {
      const { params, request, status } = context;
      const result = await revokeAdminUserSession({
        actor: getAdminRouteUser(context),
        headers: request.headers,
        sessionId: params.sessionId,
        userId: params.userId,
      });

      if (result.status === "not-found") {
        return status(404, { message: "Session not found." });
      }

      if (result.status === "denied") {
        return status(result.statusCode, { message: result.message });
      }

      return {
        session: result.session,
        status: true as const,
      };
    },
    {
      sameOrigin: true,
      params: userSessionParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .post(
    "/security/force-password-reset",
    async ({ body, request, status }) => {
      const result = await forcePasswordReset({
        email: body.email,
        headers: request.headers,
      });

      if (result.status === "not-found") {
        return status(404, { message: "User not found." });
      }

      if (result.status === "partial-failure") {
        return status(503, {
          message: `Revoked ${result.revokedSessions} sessions for ${result.targetEmail}, but the reset email request failed. Try requesting the reset again.`,
          resetEmailDelivery: result.resetEmailDelivery,
          revokedSessions: result.revokedSessions,
          status: false as const,
        });
      }

      return {
        message: `Revoked ${result.revokedSessions} sessions for ${result.targetEmail}. A password reset email was requested, but delivery cannot be confirmed. Request another reset if the user does not receive it.`,
        resetEmailDelivery: result.resetEmailDelivery,
        revokedSessions: result.revokedSessions,
        status: true as const,
        user: result.user,
      };
    },
    {
      sameOrigin: true,
      body: forcePasswordResetSchema,
      response: {
        200: adminPasswordResetSuccessResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
        503: adminPasswordResetPartialFailureResponseSchema,
      },
    },
  )
  .post("/security/revoke-all-sessions", async () => revokeEverySession(), {
    sameOrigin: true,
    response: {
      200: adminRevokeAllSessionsResponseSchema,
      403: messageResponseSchema,
      500: messageResponseSchema,
    },
  });
