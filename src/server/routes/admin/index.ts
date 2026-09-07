import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import db from "@/server/db";
import {
  getUserForPasswordReset,
  revokeAllSessions,
  revokeUserSessions,
} from "@/server/db/dal/security";
import {
  account as accountTable,
  session as sessionTable,
} from "@/server/db/schema";
import { emailSchema } from "@/zod/helpers";
import { elysiaAuth } from "../auth";

const forcePasswordResetSchema = z.object({
  email: emailSchema,
});

function jsonResponse(message: string, status: number) {
  return Response.json({ message }, { status });
}

function forbiddenResponse() {
  return jsonResponse("Invalid request origin.", 403);
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

async function parseJsonRequest(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(elysiaAuth)
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
    async ({ params, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const [linkedAccount] = await db
        .select({
          accountId: accountTable.accountId,
          id: accountTable.id,
          providerId: accountTable.providerId,
        })
        .from(accountTable)
        .where(
          and(
            eq(accountTable.id, params.accountRowId),
            eq(accountTable.userId, params.userId),
          ),
        )
        .limit(1);

      if (!linkedAccount) {
        return jsonResponse("Linked account not found.", 404);
      }

      if (linkedAccount.providerId === "credential") {
        return jsonResponse(
          "Password credentials cannot be unlinked here.",
          400,
        );
      }

      await db
        .delete(accountTable)
        .where(
          and(
            eq(accountTable.id, linkedAccount.id),
            eq(accountTable.userId, params.userId),
          ),
        );

      return {
        account: linkedAccount,
        status: true,
      };
    },
    {
      admin: true,
    },
  )
  .delete(
    "/users/:userId/sessions/:sessionId",
    async ({ params, request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const [userSession] = await db
        .select({
          id: sessionTable.id,
          userId: sessionTable.userId,
        })
        .from(sessionTable)
        .where(
          and(
            eq(sessionTable.id, params.sessionId),
            eq(sessionTable.userId, params.userId),
          ),
        )
        .limit(1);

      if (!userSession) {
        return jsonResponse("Session not found.", 404);
      }

      await db
        .delete(sessionTable)
        .where(
          and(
            eq(sessionTable.id, userSession.id),
            eq(sessionTable.userId, params.userId),
          ),
        );

      return {
        session: userSession,
        status: true,
      };
    },
    {
      admin: true,
    },
  )
  .post(
    "/security/force-password-reset",
    async ({ request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

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
      const result = await auth.api.requestPasswordReset({
        body: {
          email: targetUser.email,
          redirectTo: `${env.NEXT_PUBLIC_BASE_URL}/reset-password`,
        },
        headers: request.headers,
      });

      return {
        message: `${result.message} Revoked ${revokedSessions.length} sessions for ${targetUser.email}.`,
        revokedSessions: revokedSessions.length,
        status: true,
        user: targetUser,
      };
    },
    {
      admin: true,
    },
  )
  .post(
    "/security/revoke-all-sessions",
    async ({ request }) => {
      const invalidMutationResponse = validateMutationRequest(request);

      if (invalidMutationResponse) {
        return invalidMutationResponse;
      }

      const revokedSessions = await revokeAllSessions();

      return {
        revokedSessions: revokedSessions.length,
        status: true,
      };
    },
    {
      admin: true,
    },
  );
