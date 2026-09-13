import { Elysia } from "elysia";
import { z } from "zod";

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
import {
  adminCreateEmailListSchema,
  emailListKeySchema,
  emailListStatusSchema,
} from "@/zod";
import { emailSchema } from "@/zod/helpers";
import { elysiaAuth } from "../auth";
import { requestPolicy } from "../request-policy";

const forcePasswordResetSchema = z.object({
  email: emailSchema,
});
const emailListStatusUpdateSchema = z.object({
  key: emailListKeySchema,
  status: emailListStatusSchema,
});

function jsonResponse(message: string, status: number) {
  return Response.json({ message }, { status });
}

async function parseJsonRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

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
    async ({ params }) => {
      const result = await deleteAdminLinkedAccount(
        params.userId,
        params.accountRowId,
      );

      if (result.status === "not-found") {
        return jsonResponse("Linked account not found.", 404);
      }

      if (result.status === "credential") {
        return jsonResponse(
          "Password credentials cannot be unlinked here.",
          400,
        );
      }

      return {
        account: result.account,
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .delete(
    "/users/:userId/sessions/:sessionId",
    async ({ params }) => {
      const userSession = await deleteAdminUserSession(
        params.userId,
        params.sessionId,
      );

      if (!userSession) {
        return jsonResponse("Session not found.", 404);
      }

      return {
        session: userSession,
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .post(
    "/email-list",
    async ({ request }) => {
      const parsed = adminCreateEmailListSchema.safeParse(
        await parseJsonRequest(request),
      );

      if (!parsed.success) {
        return jsonResponse(
          parsed.error.issues[0]?.message ?? "Invalid email list request.",
          400,
        );
      }

      const list = await createEmailList(parsed.data);

      return {
        list,
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .patch(
    "/email-list/:key",
    async ({ params, request }) => {
      const body = await parseJsonRequest(request);
      const parsed = adminCreateEmailListSchema.safeParse({
        ...(body && typeof body === "object" ? body : {}),
        key: params.key,
      });

      if (!parsed.success) {
        return jsonResponse(
          parsed.error.issues[0]?.message ?? "Invalid email list request.",
          400,
        );
      }

      const list = await updateEmailList(parsed.data);

      if (!list) {
        return jsonResponse("Email list not found.", 404);
      }

      return {
        list,
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .patch(
    "/email-list/:key/status",
    async ({ params, request }) => {
      const body = await parseJsonRequest(request);
      const parsedStatus = emailListStatusUpdateSchema.safeParse({
        ...(body && typeof body === "object" ? body : {}),
        key: params.key,
      });

      if (!parsedStatus.success) {
        return jsonResponse("Invalid email list status.", 400);
      }

      const list = await updateEmailListStatus(parsedStatus.data);

      if (!list) {
        return jsonResponse("Email list not found.", 404);
      }

      return {
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .delete(
    "/email-list/:key",
    async ({ params }) => {
      const result = await deleteEmailList(params.key);

      if (result.status === "protected") {
        return jsonResponse("Built-in email lists cannot be deleted.", 400);
      }

      if (result.status === "not-found") {
        return jsonResponse("Email list not found.", 404);
      }

      return {
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .post(
    "/security/force-password-reset",
    async ({ request }) => {
      const parsed = forcePasswordResetSchema.safeParse(
        await parseJsonRequest(request),
      );

      if (!parsed.success) {
        return jsonResponse(
          parsed.error.issues[0]?.message ?? "Invalid password reset request.",
          400,
        );
      }

      const targetUser = await getUserForPasswordReset(parsed.data.email);

      if (!targetUser) {
        return jsonResponse("User not found.", 404);
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
        return Response.json(
          {
            message: `Revoked ${revokedSessions.length} sessions for ${targetUser.email}, but the reset email request failed. Try requesting the reset again.`,
            resetEmailDelivery: "unconfirmed",
            revokedSessions: revokedSessions.length,
            status: false,
          },
          { status: 503 },
        );
      }

      return {
        message: `Revoked ${revokedSessions.length} sessions for ${targetUser.email}. A password reset email was requested, but delivery cannot be confirmed. Request another reset if the user does not receive it.`,
        resetEmailDelivery: "unconfirmed" as const,
        revokedSessions: revokedSessions.length,
        status: true,
        user: targetUser,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  )
  .post(
    "/security/revoke-all-sessions",
    async () => {
      const revokedSessions = await revokeAllSessions();

      return {
        revokedSessions: revokedSessions.length,
        status: true,
      };
    },
    {
      admin: true,
      sameOrigin: true,
    },
  );
