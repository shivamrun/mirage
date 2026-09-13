import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  deleteAdminLinkedAccount,
  deleteAdminUserSession,
} from "@/server/db/dal/admin-user-detail";
import {
  createEmailList,
  deleteEmailList,
  updateEmailList,
  updateEmailListStatus,
} from "@/server/db/dal/email-list";
import {
  getUserForPasswordReset,
  revokeAllSessions,
  revokeUserSessions,
} from "@/server/db/dal/security";
import { elysiaAuth } from "@/server/http/auth";
import { requestPolicy } from "@/server/http/request-policy";
import {
  adminCreateEmailListSchema,
  adminPasswordResetPartialFailureResponseSchema,
  adminStatusResponseSchema,
  adminUpdateEmailListSchema,
  emailListKeyParamsSchema,
  emailListStatusUpdateBodySchema,
  forcePasswordResetSchema,
  linkedAccountParamsSchema,
  messageResponseSchema,
  userSessionParamsSchema,
} from "@/zod";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(elysiaAuth)
  .use(requestPolicy)
  .get(
    "/",
    ({ authUser }) => ({
      area: "admin",
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
      },
    }),
    {
      admin: true,
    },
  )
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
      admin: true,
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
      admin: true,
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
    "/email-list",
    async ({ body }) => {
      const list = await createEmailList(body);

      return {
        list,
        status: true as const,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      body: adminCreateEmailListSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .patch(
    "/email-list/:key",
    async ({ body, params, status }) => {
      const list = await updateEmailList({
        ...body,
        key: params.key,
      });

      if (!list) {
        return status(404, { message: "Email list not found." });
      }

      return {
        list,
        status: true as const,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      body: adminUpdateEmailListSchema,
      params: emailListKeyParamsSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  )
  .patch(
    "/email-list/:key/status",
    async ({ body, params, status }) => {
      const list = await updateEmailListStatus({
        key: params.key,
        status: body.status,
      });

      if (!list) {
        return status(404, { message: "Email list not found." });
      }

      return {
        status: true as const,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      body: emailListStatusUpdateBodySchema,
      params: emailListKeyParamsSchema,
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
    "/email-list/:key",
    async ({ params, status }) => {
      const result = await deleteEmailList(params.key);

      if (result.status === "protected") {
        return status(400, {
          message: "Built-in email lists cannot be deleted.",
        });
      }

      if (result.status === "not-found") {
        return status(404, { message: "Email list not found." });
      }

      return {
        status: true as const,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      params: emailListKeyParamsSchema,
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
      const targetUser = await getUserForPasswordReset(body.email);

      if (!targetUser) {
        return status(404, { message: "User not found." });
      }

      const revokedSessions = await revokeUserSessions(targetUser.id);
      try {
        await auth.api.requestPasswordReset({
          body: {
            email: targetUser.email,
            redirectTo: `${env.NEXT_PUBLIC_BASE_URL}/reset-password`,
          },
          headers: request.headers,
        });
      } catch {
        console.error("Admin password-reset request failed after revocation.");
        return status(503, {
          message: `Revoked ${revokedSessions.length} sessions for ${targetUser.email}, but the reset email request failed. Try requesting the reset again.`,
          resetEmailDelivery: "unconfirmed",
          revokedSessions: revokedSessions.length,
          status: false,
        });
      }

      return {
        message: `Revoked ${revokedSessions.length} sessions for ${targetUser.email}. A password reset email was requested, but delivery cannot be confirmed. Request another reset if the user does not receive it.`,
        resetEmailDelivery: "unconfirmed" as const,
        revokedSessions: revokedSessions.length,
        status: true as const,
        user: targetUser,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      body: forcePasswordResetSchema,
      response: {
        200: adminStatusResponseSchema,
        400: messageResponseSchema,
        403: messageResponseSchema,
        404: messageResponseSchema,
        500: messageResponseSchema,
        503: adminPasswordResetPartialFailureResponseSchema,
      },
    },
  )
  .post(
    "/security/revoke-all-sessions",
    async () => {
      const revokedSessions = await revokeAllSessions();

      return {
        revokedSessions: revokedSessions.length,
        status: true as const,
      };
    },
    {
      admin: true,
      sameOrigin: true,
      response: {
        200: adminStatusResponseSchema,
        403: messageResponseSchema,
        500: messageResponseSchema,
      },
    },
  );
