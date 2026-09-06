import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { env } from "@/lib/env";
import db from "@/server/db";
import {
  account as accountTable,
  session as sessionTable,
} from "@/server/db/schema";
import { elysiaAuth } from "../auth";

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
  );
