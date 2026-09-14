import { Elysia } from "elysia";

import { auth } from "@/lib/auth";
import {
  adminAccessMessages,
  evaluateAdminAccess,
  evaluateAdminRole,
  evaluateAdminSessionAssurance,
  evaluateTwoFactorEnabled,
  evaluateVerifiedEmail,
} from "@/lib/auth/admin-access";
import {
  type AuthSession,
  type CurrentUser,
  getCurrentUserFromAuthSession,
} from "@/lib/auth/current-user";

export type { AuthSession };

async function resolveAuthSession(headers: Headers) {
  return auth.api.getSession({
    headers,
    query: {
      disableCookieCache: true,
    },
  });
}

function getAuthUserFromContext(context: unknown) {
  return (context as { authUser?: CurrentUser }).authUser ?? null;
}

export const elysiaAuth = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ request, status }) {
      const authSession = await resolveAuthSession(request.headers);

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
      const authSession = await resolveAuthSession(request.headers);
      const authUser = authSession
        ? await getCurrentUserFromAuthSession(authSession)
        : null;

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
      const authSession = await resolveAuthSession(request.headers);
      const authUser = authSession
        ? await getCurrentUserFromAuthSession(authSession)
        : null;

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
      const authSession = await resolveAuthSession(request.headers);
      const authUser = authSession
        ? await getCurrentUserFromAuthSession(authSession)
        : null;

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
