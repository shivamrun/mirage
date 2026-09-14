import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import {
  canDeleteLinkedAccount,
  canDeleteUserSession,
} from "@/lib/auth/admin-access";
import type { CurrentUser } from "@/lib/auth/current-user";
import {
  forcePasswordReset,
  revokeEverySession,
} from "@/server/admin/security";
import {
  deleteAdminLinkedAccount,
  getAdminLinkedAccountForDeletion,
  getAdminUserSessionForDeletion,
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

function getAdminRouteUser(context: unknown) {
  return (context as { authUser: CurrentUser }).authUser;
}

export const adminUserSecurityRoutes = new Elysia()
  .use(requestPolicy)
  .delete(
    "/users/:userId/accounts/:accountRowId",
    async (context) => {
      const { params, status } = context;
      const target = await getAdminLinkedAccountForDeletion(
        params.userId,
        params.accountRowId,
      );

      if (target.status === "not-found") {
        return status(404, { message: "Linked account not found." });
      }

      if (target.status === "credential") {
        return status(400, {
          message: "Password credentials cannot be unlinked here.",
        });
      }

      const decision = canDeleteLinkedAccount({
        actor: getAdminRouteUser(context),
        remainingSignInMethods: target.remainingSignInMethods,
      });

      if (!decision.allowed) {
        const denial = decision;

        return status(denial.statusCode, { message: denial.message });
      }

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

      if (result.status === "last-method") {
        return status(403, {
          message: "Cannot unlink the user's last sign-in method.",
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
    async (context) => {
      const { params, request, status } = context;
      const userSession = await getAdminUserSessionForDeletion(
        params.userId,
        params.sessionId,
      );

      if (!userSession) {
        return status(404, { message: "Session not found." });
      }

      const decision = canDeleteUserSession({
        actor: getAdminRouteUser(context),
        targetSessionUserId: userSession.userId,
      });

      if (!decision.allowed) {
        const denial = decision;

        return status(denial.statusCode, { message: denial.message });
      }

      await auth.api.revokeUserSession({
        body: {
          sessionToken: userSession.token,
        },
        headers: request.headers,
      });

      return {
        session: {
          id: userSession.id,
          userId: userSession.userId,
        },
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
