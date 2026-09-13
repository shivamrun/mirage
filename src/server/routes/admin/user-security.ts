import { Elysia } from "elysia";

import {
  forcePasswordReset,
  revokeEverySession,
} from "@/server/admin/security";
import {
  deleteAdminLinkedAccount,
  deleteAdminUserSession,
} from "@/server/db/dal/admin-user-detail";
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

export const adminUserSecurityRoutes = new Elysia()
  .use(requestPolicy)
  .delete(
    "/users/:userId/accounts/:accountRowId",
    async ({ params, status }) => {
      const result = await deleteAdminLinkedAccount(
        params.userId,
        params.accountRowId,
      );

      if (result.status === "not-found") {
        return status(404, { message: "Linked account not found." });
      }

      if (result.status === "credential") {
        return status(400, {
          message: "Password credentials cannot be unlinked here.",
        });
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
    async ({ params, status }) => {
      const userSession = await deleteAdminUserSession(
        params.userId,
        params.sessionId,
      );

      if (!userSession) {
        return status(404, { message: "Session not found." });
      }

      return {
        session: userSession,
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
