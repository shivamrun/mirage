import { Elysia } from "elysia";

import {
  adminAccessMessages,
  evaluateAdminAccess,
  evaluateAdminRole,
  evaluateAdminSessionAssurance,
  evaluateTwoFactorEnabled,
  evaluateVerifiedEmail,
} from "@/server/db/services/auth/admin-access";
import {
  type AuthSession,
  type CurrentUser,
  getCurrentUserFromAuthSession,
  resolveAuthSession,
} from "@/server/db/services/auth/current-user";

export type { AuthSession };

function getAuthUserFromContext(context: unknown) {
  return (context as { authUser?: CurrentUser }).authUser ?? null;
}

async function resolveRequestAuth(headers: Headers) {
  const authSession = await resolveAuthSession({
    headers,
    sessionCookieCache: "bypass",
  });
  const authUser = authSession
    ? await getCurrentUserFromAuthSession(authSession)
    : null;

  return {
    authSession,
    authUser,
  };
}

export const elysiaAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ request, status }) {
      const authSession = await resolveAuthSession({
        headers: request.headers,
        sessionCookieCache: "bypass",
      });

      if (!authSession) {
        return status(401, { message: "Unauthorized" });
      }

      return {
        authSession,
        session: authSession.session,
        user: authSession.user,
      };
    },
  },
  currentUser: {
    async resolve({ request, status }) {
      const { authSession, authUser } = await resolveRequestAuth(
        request.headers,
      );

      if (!authSession || !authUser) {
        return status(401, { message: "Unauthorized" });
      }

      return {
        authSession,
        authUser,
        session: authSession.session,
        user: authSession.user,
      };
    },
  },
  admin: {
    async resolve({ request, status }) {
      const { authSession, authUser } = await resolveRequestAuth(
        request.headers,
      );

      const decision = evaluateAdminRole(authUser);

      if (!authSession || !authUser || !decision.allowed) {
        return status(404, { message: adminAccessMessages.notFound });
      }

      return {
        authSession,
        authUser,
        session: authSession.session,
        user: authSession.user,
      };
    },
  },
  adminAccess: {
    async resolve({ request, status }) {
      const { authSession, authUser } = await resolveRequestAuth(
        request.headers,
      );

      const decision = await evaluateAdminAccess(authUser);

      if (!authSession || !authUser) {
        return status(404, { message: adminAccessMessages.notFound });
      }

      if (!decision.allowed) {
        const denial = decision;

        return status(denial.statusCode, { message: denial.message });
      }

      return {
        authSession,
        authUser,
        session: authSession.session,
        user: authSession.user,
      };
    },
  },
  verifiedEmail: {
    async beforeHandle(context) {
      const authUser = getAuthUserFromContext(context);

      if (!authUser) {
        return context.status(401, { message: "Unauthorized" });
      }

      const decision = evaluateVerifiedEmail(authUser);

      if (!decision.allowed) {
        return context.status(decision.statusCode, {
          message: decision.message,
        });
      }
    },
  },
  twoFactor: {
    async beforeHandle(context) {
      const authUser = getAuthUserFromContext(context);

      if (!authUser) {
        return context.status(401, { message: "Unauthorized" });
      }

      const decision = evaluateTwoFactorEnabled(authUser);

      if (!decision.allowed) {
        return context.status(decision.statusCode, {
          message: decision.message,
        });
      }
    },
  },
  adminSessionAssurance: {
    async beforeHandle(context) {
      const authUser = getAuthUserFromContext(context);

      if (!authUser) {
        return context.status(401, { message: "Unauthorized" });
      }

      const decision = await evaluateAdminSessionAssurance(authUser);

      if (!decision.allowed) {
        return context.status(decision.statusCode, {
          message: decision.message,
        });
      }
    },
  },
});
